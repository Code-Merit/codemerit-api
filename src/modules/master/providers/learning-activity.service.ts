import { Injectable } from '@nestjs/common';
import { EnrollmentTierEnum, isTierAtLeast } from 'src/common/enum/enrollment-tier.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { isLessonLocked } from 'src/common/enum/lesson-access-level.enum';
import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';
import { DailyQuestBonus } from 'src/common/typeorm/entities/daily-quest-bonus.entity';
import { DataSource } from 'typeorm';
import { FREE_PREVIEW_COUNT } from 'src/common/constants/interview-questions.constants';
import { SkillEnrollmentService } from '../../skill-enrollment/providers/skill-enrollment.service';

// Days of history the learning dashboard's practice rhythm shows.
export const ACTIVITY_DAYS = 60;
// Daily quests: read a lesson, answer this many practice questions, study an interview question.
export const QUEST_PRACTICE_TARGET = 10;
export const QUEST_BONUS_XP = 50;

const CONTINUE_LESSON_COUNT = 4;

export interface ActivityDay {
  date: string; // YYYY-MM-DD, server-local
  lessons: number;
  practice: number;
  correct: number;
  interview: number;
  xp: number;
  minutes: number;
}

export interface LessonRow {
  id: number;
  slug: string;
  title: string;
  subjectId: number;
  level: number;
  status: UserLessonTrackerStatusEnum | null;
  progressPercent: number;
  lastOpenedAt: Date | null;
  slides: number;
  // The learner's plan doesn't open this lesson (isLessonLocked, the lesson service's own rule).
  locked: boolean;
}

export interface DashboardLesson {
  id: number;
  slug: string;
  title: string;
  subjectId: number;
  progressPercent: number;
  slides: number;
  slidesLeft: number;
}

// Server-local calendar day — the same "today" the daily question cap uses.
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Stable string hash (FNV-1a) — picks the same question of the day all day for a user.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The learning dashboard's activity data: per-day counts, today's quests, lessons with progress
 * and the interview question of the day. Reads only — the dashboard call composes it. */
@Injectable()
export class LearningActivityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly skillEnrollmentService: SkillEnrollmentService,
  ) {}

  /** One row per day for the last `days` days, oldest first, empty days included. Practice counts
   * answered (not skipped) questions; lessons count first completions; interview counts questions
   * marked studied. */
  async getDailyActivity(userId: number, days = ACTIVITY_DAYS): Promise<ActivityDay[]> {
    const start = startOfToday();
    start.setDate(start.getDate() - (days - 1));
    const day = (col: string) => `DATE_FORMAT(${col}, '%Y-%m-%d')`;

    const [attempts, lessons, interview, xp] = await Promise.all([
      this.dataSource.createQueryBuilder()
        .select(day('qa.createdAt'), 'day')
        .addSelect('COUNT(*)', 'practice')
        .addSelect('SUM(qa.isCorrect = 1)', 'correct')
        .addSelect('COALESCE(SUM(qa.timeTaken), 0)', 'seconds')
        .from('question_attempt', 'qa')
        .where('qa.userId = :userId', { userId })
        .andWhere('qa.createdAt >= :start', { start })
        .andWhere('(qa.isSkipped = 0 OR qa.isSkipped IS NULL)')
        .groupBy('day')
        .getRawMany(),
      this.countByDay('user_lesson_tracker', 'completedAt', userId, start),
      this.countByDay('user_question_tracker', 'completedAt', userId, start),
      this.dataSource.createQueryBuilder()
        .select(day('x.createdAt'), 'day')
        .addSelect('COALESCE(SUM(x.xpAwarded), 0)', 'xp')
        .from('user_xp_log', 'x')
        .where('x.userId = :userId', { userId })
        .andWhere('x.createdAt >= :start', { start })
        .groupBy('day')
        .getRawMany(),
    ]);

    const attemptsByDay = new Map(attempts.map((r) => [r.day, r]));
    const lessonsByDay = new Map(lessons.map((r) => [r.day, +r.count]));
    const interviewByDay = new Map(interview.map((r) => [r.day, +r.count]));
    const xpByDay = new Map(xp.map((r) => [r.day, +r.xp]));

    const rows: ActivityDay[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = localDateKey(date);
      const a = attemptsByDay.get(key);
      rows.push({
        date: key,
        lessons: lessonsByDay.get(key) ?? 0,
        practice: a ? +a.practice : 0,
        correct: a ? +a.correct : 0,
        interview: interviewByDay.get(key) ?? 0,
        xp: xpByDay.get(key) ?? 0,
        minutes: a ? Math.round(+a.seconds / 60) : 0,
      });
    }
    return rows;
  }

  private countByDay(table: string, column: string, userId: number, start: Date) {
    return this.dataSource.createQueryBuilder()
      .select(`DATE_FORMAT(t.${column}, '%Y-%m-%d')`, 'day')
      .addSelect('COUNT(*)', 'count')
      .from(table, 't')
      .where('t.userId = :userId', { userId })
      .andWhere(`t.${column} >= :start`, { start })
      .groupBy('day')
      .getRawMany();
  }

  /** Today's three quests from today's activity row, and the bonus state. */
  buildTodayQuests(today: ActivityDay | undefined, bonusClaimed: boolean) {
    const quest = (key: 'lesson' | 'practice' | 'interview', target: number, progress: number) =>
      ({ key, target, progress, done: progress >= target });
    const quests = [
      quest('lesson', 1, today?.lessons ?? 0),
      quest('practice', QUEST_PRACTICE_TARGET, today?.practice ?? 0),
      quest('interview', 1, today?.interview ?? 0),
    ];
    const allDone = quests.every((q) => q.done);
    return {
      date: today?.date ?? localDateKey(new Date()),
      quests,
      bonus: { xp: QUEST_BONUS_XP, claimed: bonusClaimed, claimable: allDone && !bonusClaimed },
    };
  }

  /** Has today's quest bonus already been claimed? */
  async isQuestBonusClaimed(userId: number): Promise<boolean> {
    const count = await this.dataSource.getRepository(DailyQuestBonus).count({
      where: { userId, questDate: localDateKey(new Date()) },
    });
    return count > 0;
  }

  /** Every lesson in the given subjects with the user's progress, slide count and whether their
   * plan opens it — the dashboard derives lesson completion counts and picks lessons from these. */
  async getLessonsWithProgress(userId: number, subjectIds: number[]): Promise<LessonRow[]> {
    if (!subjectIds.length) return [];
    const [rows, tierMap] = await Promise.all([this.dataSource.createQueryBuilder()
      .select('l.id', 'id')
      .addSelect('l.slug', 'slug')
      .addSelect('l.title', 'title')
      .addSelect('l.subjectId', 'subjectId')
      .addSelect('l.level', 'level')
      .addSelect('l.accessLevel', 'accessLevel')
      .addSelect('ult.status', 'status')
      .addSelect('ult.progressPercent', 'progressPercent')
      .addSelect('ult.updatedAt', 'lastOpenedAt')
      .addSelect('(SELECT COUNT(*) FROM lesson_section ls WHERE ls.lessonId = l.id)', 'slides')
      .from('lesson', 'l')
      .leftJoin('user_lesson_tracker', 'ult', 'ult.lessonId = l.id AND ult.userId = :userId', { userId })
      .where('l.subjectId IN (:...subjectIds)', { subjectIds })
      .getRawMany(),
      this.skillEnrollmentService.getSubjectTierMap(userId),
    ]);

    return rows.map((r) => ({
      id: +r.id,
      slug: r.slug,
      title: r.title,
      subjectId: +r.subjectId,
      level: +r.level || 1,
      status: r.status ?? null,
      progressPercent: +r.progressPercent || 0,
      lastOpenedAt: r.lastOpenedAt ?? null,
      slides: +r.slides || 0,
      locked: isLessonLocked(r.accessLevel, tierMap.get(+r.subjectId) ?? null),
    }));
  }

  /** Lessons opened but not completed, most recent first, and the first unstarted lessons by level
   * in the role's subject order. Only lessons the learner's plan opens, so every link works. */
  pickDashboardLessons(lessons: LessonRow[], subjectOrder: number[]): { inProgress: DashboardLesson[]; recommended: DashboardLesson[] } {
    const toDashboard = (l: LessonRow): DashboardLesson => ({
      id: l.id, slug: l.slug, title: l.title, subjectId: l.subjectId,
      progressPercent: l.progressPercent, slides: l.slides,
      slidesLeft: Math.max(0, Math.round(l.slides * (1 - l.progressPercent / 100))),
    });
    const isStarted = (l: LessonRow) => l.status === UserLessonTrackerStatusEnum.Read || l.progressPercent > 0;

    const open = lessons.filter((l) => !l.locked);
    const inProgress = open
      .filter((l) => l.status !== UserLessonTrackerStatusEnum.Completed && isStarted(l))
      .sort((a, b) => new Date(b.lastOpenedAt ?? 0).getTime() - new Date(a.lastOpenedAt ?? 0).getTime())
      .slice(0, CONTINUE_LESSON_COUNT)
      .map(toDashboard);

    const rank = new Map(subjectOrder.map((id, i) => [id, i]));
    const recommended = open
      .filter((l) => l.status !== UserLessonTrackerStatusEnum.Completed && !isStarted(l))
      .sort((a, b) => a.level - b.level || (rank.get(a.subjectId) ?? 99) - (rank.get(b.subjectId) ?? 99) || a.id - b.id)
      .slice(0, CONTINUE_LESSON_COUNT)
      .map(toDashboard);

    return { inProgress, recommended };
  }

  /** One interview question for today from the given subjects, picked only from questions the user
   * can open (all of them at Intern and above, else the free preview — the first FREE_PREVIEW_COUNT
   * per topic, the question bank's own rule). Stays the same all day, even once studied. */
  async getInterviewOfTheDay(userId: number, subjectIds: number[]) {
    if (!subjectIds.length) return null;
    const today = startOfToday();

    const [rows, tierMap] = await Promise.all([
      this.dataSource.createQueryBuilder()
        .select('q.id', 'id')
        .addSelect('q.subjectId', 'subjectId')
        .addSelect('ROW_NUMBER() OVER (PARTITION BY qt.topicId ORDER BY q.level ASC, q.orderId ASC)', 'rn')
        .addSelect('uqt.completedAt', 'studiedAt')
        .from('question', 'q')
        .innerJoin('question_topic', 'qt', 'qt.questionId = q.id')
        .leftJoin('user_question_tracker', 'uqt', 'uqt.questionId = q.id AND uqt.userId = :userId', { userId })
        .where('q.subjectId IN (:...subjectIds)', { subjectIds })
        .andWhere('q.questionType = :general', { general: QuestionTypeEnum.General })
        .andWhere('q.status = :active', { active: QuestionStatusEnum.Active })
        .getRawMany(),
      this.skillEnrollmentService.getSubjectTierMap(userId),
    ]);

    // A question mapped to several topics appears once per topic — keep its earliest position.
    const byId = new Map<number, { subjectId: number; rn: number; studiedAt: Date | null }>();
    for (const r of rows) {
      const prev = byId.get(+r.id);
      if (!prev || +r.rn < prev.rn) byId.set(+r.id, { subjectId: +r.subjectId, rn: +r.rn, studiedAt: r.studiedAt ?? null });
    }

    const fullAccess = (subjectId: number) => {
      const tier = tierMap.get(subjectId);
      return !!tier && isTierAtLeast(tier, EnrollmentTierEnum.Intern);
    };
    const pool = [...byId.entries()]
      .filter(([, q]) => fullAccess(q.subjectId) || q.rn <= FREE_PREVIEW_COUNT)
      .filter(([, q]) => !q.studiedAt || new Date(q.studiedAt) >= today)
      .map(([id]) => id)
      .sort((a, b) => a - b);
    if (!pool.length) return null;

    // Each question gets its own score for the day and the lowest wins, so the pick holds even
    // when other questions join or leave the pool during the day.
    const seed = `${userId}:${localDateKey(today)}`;
    const pickId = pool.reduce((best, id) => (hash(`${seed}:${id}`) < hash(`${seed}:${best}`) ? id : best));
    const pick = byId.get(pickId)!;
    const inSubject = [...byId.values()].filter((q) => q.subjectId === pick.subjectId);

    const detail = await this.dataSource.createQueryBuilder()
      .select('q.id', 'id')
      .addSelect('q.slug', 'slug')
      .addSelect('q.level', 'level')
      .addSelect('q.tag', 'tag')
      .addSelect('q.question', 'question')
      .addSelect('q.answer', 'answerHtml')
      .addSelect('s.title', 'subjectTitle')
      .addSelect('s.slug', 'subjectSlug')
      .addSelect('s.image', 'subjectImage')
      .from('question', 'q')
      .innerJoin('subject', 's', 's.id = q.subjectId')
      .where('q.id = :id', { id: pickId })
      .getRawOne();
    if (!detail) return null;

    return {
      id: +detail.id,
      slug: detail.slug,
      level: +detail.level,
      // 'Coding' questions are a code snippet, a blank line, then the prompt.
      tag: detail.tag ?? null,
      question: detail.question,
      answerHtml: detail.answerHtml,
      studied: !!pick.studiedAt,
      subject: { id: pick.subjectId, title: detail.subjectTitle, slug: detail.subjectSlug, image: detail.subjectImage },
      subjectStudied: inSubject.filter((q) => q.studiedAt).length,
      subjectTotal: inSubject.length,
    };
  }
}
