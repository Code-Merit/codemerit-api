import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Quiz } from 'src/common/typeorm/entities/quiz.entity';
import { UserQuiz } from 'src/common/typeorm/entities/user-quiz.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { UserLessonTracker } from 'src/common/typeorm/entities/user-lesson-tracker.entity';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';
import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';

@Injectable()
export class AdminEngagementService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,

    @InjectRepository(UserQuiz)
    private readonly userQuizRepo: Repository<UserQuiz>,

    @InjectRepository(QuizResult)
    private readonly quizResultRepo: Repository<QuizResult>,

    @InjectRepository(QuestionAttempt)
    private readonly attemptRepo: Repository<QuestionAttempt>,

    @InjectRepository(UserLessonTracker)
    private readonly userLessonTrackerRepo: Repository<UserLessonTracker>,
  ) {}

  async getEngagementStats() {
    const [quizzes, questionAttempts, lessons] = await Promise.all([
      this.getQuizStats(),
      this.getQuestionAttemptStats(),
      this.getLessonEngagementStats(),
    ]);

    return { quizzes, questionAttempts, lessons };
  }

  private async getQuizStats() {
    // Standard/UserQuiz now live in separate tables (`quiz` is Standard-only,
    // `user_quiz` holds the ephemeral practice quizzes) — query each and combine,
    // rather than the single-table quizType breakdown this used to be.
    const [standardStats, userQuizStats] = await Promise.all([
      this.quizRepo
        .createQueryBuilder('qz')
        .select([
          'COUNT(qz.id) as total',
          `SUM(CASE WHEN qz.isPublished = true THEN 1 ELSE 0 END) as published`,
          `SUM(CASE WHEN qz.isPublished = false THEN 1 ELSE 0 END) as draft`,
          `SUM(
            CASE WHEN EXISTS (
              SELECT 1 FROM quiz_result qr WHERE qr.quizId = qz.id
            ) THEN 1 ELSE 0 END
          ) as playedQuizzes`,
        ])
        .getRawOne(),
      this.userQuizRepo
        .createQueryBuilder('uq')
        .select([
          'COUNT(uq.id) as total',
          `SUM(
            CASE WHEN EXISTS (
              SELECT 1 FROM quiz_result qr WHERE qr.userQuizId = uq.id
            ) THEN 1 ELSE 0 END
          ) as playedQuizzes`,
        ])
        .getRawOne(),
    ]);

    const [totalPlaysResult, avgScoreResult, topQuizzesRaw] = await Promise.all([
      this.quizResultRepo.createQueryBuilder('qr').select('COUNT(qr.id)', 'totalPlays').getRawOne(),
      this.quizResultRepo.createQueryBuilder('qr').select('AVG(qr.score)', 'avgScore').getRawOne(),
      // Scoped to Standard content only — a "top quizzes by plays" leaderboard isn't
      // a meaningful metric for ephemeral, largely one-off UserQuiz rows.
      this.quizResultRepo
        .createQueryBuilder('qr')
        .select(['qr.quizId as quizId', 'COUNT(qr.id) as plays'])
        .where('qr.quizType = :standard', { standard: QuizTypeEnum.Standard })
        .groupBy('qr.quizId')
        .orderBy('plays', 'DESC')
        .limit(5)
        .getRawMany(),
    ]);

    const topQuizzes = await this.attachQuizTitles(topQuizzesRaw);

    const standardTotal = +standardStats.total || 0;
    const userQuizTotal = +userQuizStats.total || 0;
    const total = standardTotal + userQuizTotal;
    const playedQuizzes = (+standardStats.playedQuizzes || 0) + (+userQuizStats.playedQuizzes || 0);
    const totalPlays = +totalPlaysResult.totalPlays || 0;
    const avgScore = +avgScoreResult.avgScore || 0;

    return {
      total,
      published: +standardStats.published || 0,
      draft: +standardStats.draft || 0,
      byType: {
        userQuiz: userQuizTotal,
        standard: standardTotal,
      },
      playedQuizzes,
      totalPlays,
      avgPlaysPerQuiz: playedQuizzes > 0 ? +(totalPlays / playedQuizzes).toFixed(2) : 0,
      avgScore: avgScore ? +avgScore.toFixed(2) : 0,
      topQuizzes,
    };
  }

  private async attachQuizTitles(rows: { quizId: string | number; plays: string | number }[]) {
    if (!rows.length) return [];
    const quizIds = rows.map((r) => +r.quizId);
    const quizzes = await this.quizRepo.findBy({ id: In(quizIds) });
    const titleById = new Map(quizzes.map((q) => [q.id, q.title]));
    return rows.map((r) => ({
      id: +r.quizId,
      title: titleById.get(+r.quizId) ?? 'Unknown',
      plays: +r.plays,
    }));
  }

  private async getQuestionAttemptStats() {
    const result = await this.attemptRepo
      .createQueryBuilder('a')
      .select([
        'COUNT(a.id) as total',
        'SUM(CASE WHEN a.isCorrect = 1 THEN 1 ELSE 0 END) as correct',
        'SUM(CASE WHEN a.isCorrect = 0 AND a.selectedOption IS NOT NULL THEN 1 ELSE 0 END) as wrong',
        'SUM(CASE WHEN a.selectedOption IS NULL THEN 1 ELSE 0 END) as skipped',
        'COUNT(DISTINCT a.userId) as distinctUsers',
      ])
      .getRawOne();

    const correct = +result.correct || 0;
    const wrong = +result.wrong || 0;

    return {
      total: +result.total || 0,
      correct,
      wrong,
      skipped: +result.skipped || 0,
      distinctUsers: +result.distinctUsers || 0,
      accuracyPercent: correct + wrong > 0 ? +((correct / (correct + wrong)) * 100).toFixed(2) : 0,
    };
  }

  private async getLessonEngagementStats() {
    const result = await this.userLessonTrackerRepo
      .createQueryBuilder('tracker')
      .select([
        'COALESCE(SUM(tracker.views), 0) as totalViews',
        `SUM(CASE WHEN tracker.status = :pending THEN 1 ELSE 0 END) as totalPending`,
        `SUM(CASE WHEN tracker.status = :completed THEN 1 ELSE 0 END) as totalCompleted`,
      ])
      .setParameters({
        pending: UserLessonTrackerStatusEnum.Pending,
        completed: UserLessonTrackerStatusEnum.Completed,
      })
      .getRawOne();

    const totalPending = +result.totalPending || 0;
    const totalCompleted = +result.totalCompleted || 0;

    return {
      totalViews: +result.totalViews || 0,
      totalPending,
      totalCompleted,
      completionRate:
        totalPending + totalCompleted > 0
          ? +((totalCompleted / (totalPending + totalCompleted)) * 100).toFixed(2)
          : 0,
    };
  }
}
