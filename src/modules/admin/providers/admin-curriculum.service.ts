import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { CERT_ACHIEVED } from 'src/common/constants/completion-thresholds';
import { minCorrectForCertification, minCorrectForSubjectTrack } from 'src/common/utils/completion-rules';
import {
  SubjectMatrixCert,
  SubjectMatrixResponse,
  SubjectMatrixRow,
  SubjectVerdict,
  SubjectVerdictBreakdown,
} from '../dtos/subject-matrix.model';

const median = (sorted: number[]) => (sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0);

/**
 * Curriculum health per subject (the "subject matrix"): topic/track structure, Active Trivia
 * depth per topic, review backlog, lesson and interview coverage, and how many correct
 * answers each subject's first and top certificates take. Only Active Trivia counts toward
 * certificates, so depth and cert costs use that bank alone; cert costs come from the same
 * completion-rules functions issuance uses.
 */
@Injectable()
export class AdminCurriculumService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
  ) {}

  async getSubjectMatrix(): Promise<SubjectMatrixResponse> {
    const q = (sql: string, params: any[] = []) => this.subjectRepo.query(sql, params);
    const [subjects, topics, subjectQuestions, trackTopics, certs] = await Promise.all([
      // Every published subject (an empty one is a curriculum gap worth showing), plus any
      // unpublished subject that already has topics.
      q(`SELECT s.id, s.slug, s.title, s.isPublished FROM subject s
         WHERE s.isPublished = 1 OR EXISTS (SELECT 1 FROM topic t WHERE t.subjectId = s.id)`),
      q(`SELECT t.id, t.subjectId,
           (SELECT COUNT(*) FROM question_topic qt JOIN question qn ON qn.id = qt.questionId
             WHERE qt.topicId = t.id AND qn.status = ? AND qn.questionType = ?) AS activeTrivia,
           EXISTS (SELECT 1 FROM lesson l WHERE l.topicId = t.id) AS hasLesson,
           EXISTS (SELECT 1 FROM subject_track_topic stt JOIN subject_track st ON st.id = stt.subjectTrackId
             WHERE stt.topicId = t.id AND st.subjectId = t.subjectId) AS inTrack
         FROM topic t`, [QuestionStatusEnum.Active, QuestionTypeEnum.Trivia]),
      // Subject-level so questions without a topic still count toward the backlog.
      q(`SELECT subjectId,
           SUM(status = ? AND questionType = ?) AS pendingTrivia,
           SUM(status = ? AND questionType = ?) AS pendingInterview,
           SUM(status = ? AND questionType = ?) AS activeInterview
         FROM question GROUP BY subjectId`,
        [QuestionStatusEnum.Pending, QuestionTypeEnum.Trivia,
         QuestionStatusEnum.Pending, QuestionTypeEnum.General,
         QuestionStatusEnum.Active, QuestionTypeEnum.General]),
      q(`SELECT st.id AS subjectTrackId, st.subjectId, stt.topicId FROM subject_track st
         LEFT JOIN subject_track_topic stt ON stt.subjectTrackId = st.id`),
      // Subject-native certificates only (what Browse Certificates shows for a subject).
      q(`SELECT ct.id, ct.title, ct.subjectId, ct.passThreshold, ctst.subjectTrackId
         FROM certification_track ct
         JOIN certification_track_subject_track ctst ON ctst.certificationTrackId = ct.id
         WHERE ct.subjectId IS NOT NULL AND ct.isPublished = 1`),
    ]);

    const triviaByTopic = new Map<number, number>(topics.map((t: any) => [Number(t.id), Number(t.activeTrivia)]));
    const questionsBySubject = new Map<number, any>(subjectQuestions.map((r: any) => [Number(r.subjectId), r]));

    // Subject track → its topics' Active Trivia counts → fewest correct answers to complete it.
    const trackTopicCounts = new Map<number, number[]>();
    const tracksBySubject = new Map<number, Set<number>>();
    for (const r of trackTopics) {
      const trackId = Number(r.subjectTrackId);
      if (!tracksBySubject.has(Number(r.subjectId))) tracksBySubject.set(Number(r.subjectId), new Set());
      tracksBySubject.get(Number(r.subjectId)).add(trackId);
      if (!trackTopicCounts.has(trackId)) trackTopicCounts.set(trackId, []);
      if (r.topicId != null) trackTopicCounts.get(trackId).push(triviaByTopic.get(Number(r.topicId)) ?? 0);
    }
    const trackMin = new Map<number, number | null>(
      [...trackTopicCounts].map(([id, counts]) => [id, minCorrectForSubjectTrack(counts)]),
    );

    const certsBySubject = new Map<number, Map<number, { id: number; title: string; passThreshold: number | null; tracks: number[] }>>();
    for (const r of certs) {
      const sid = Number(r.subjectId);
      if (!certsBySubject.has(sid)) certsBySubject.set(sid, new Map());
      const bySubject = certsBySubject.get(sid);
      if (!bySubject.has(Number(r.id))) {
        bySubject.set(Number(r.id), { id: Number(r.id), title: r.title, passThreshold: r.passThreshold, tracks: [] });
      }
      bySubject.get(Number(r.id)).tracks.push(Number(r.subjectTrackId));
    }

    const rows: SubjectMatrixRow[] = subjects.map((s: any) => {
      const sid = Number(s.id);
      const subjectTopics = topics.filter((t: any) => Number(t.subjectId) === sid);
      const counts = subjectTopics.map((t: any) => Number(t.activeTrivia)).sort((a: number, b: number) => a - b);
      const activeTrivia = counts.reduce((a: number, b: number) => a + b, 0);
      const qs = questionsBySubject.get(sid) ?? {};

      const subjectCerts: SubjectMatrixCert[] = [...(certsBySubject.get(sid)?.values() ?? [])].map((c) => ({
        id: c.id,
        title: c.title,
        subjectTracks: c.tracks.length,
        correctAnswersToEarn: minCorrectForCertification(
          c.tracks.map((t) => trackMin.get(t) ?? null),
          c.passThreshold ?? CERT_ACHIEVED,
        ),
      }));
      const byTracksThenCost = [...subjectCerts].sort(
        (a, b) => a.subjectTracks - b.subjectTracks || (a.correctAnswersToEarn ?? Infinity) - (b.correctAnswersToEarn ?? Infinity),
      );

      const row = {
        subjectId: sid,
        slug: s.slug,
        title: s.title,
        isPublished: !!Number(s.isPublished),
        topics: subjectTopics.length,
        subjectTracks: tracksBySubject.get(sid)?.size ?? 0,
        topicsWithoutTrack: subjectTopics.filter((t: any) => !Number(t.inTrack)).length,
        activeTrivia,
        perTopicMin: counts[0] ?? 0,
        perTopicMedian: median(counts),
        perTopicMean: counts.length ? Math.round((activeTrivia / counts.length) * 10) / 10 : 0,
        perTopicMax: counts[counts.length - 1] ?? 0,
        pendingTrivia: Number(qs.pendingTrivia ?? 0),
        pendingInterview: Number(qs.pendingInterview ?? 0),
        topicsWithLesson: subjectTopics.filter((t: any) => Number(t.hasLesson)).length,
        activeInterview: Number(qs.activeInterview ?? 0),
        entryCert: byTracksThenCost[0] ?? null,
        topCert: byTracksThenCost.length ? byTracksThenCost[byTracksThenCost.length - 1] : null,
      };
      const { verdict, score, breakdown } = this.scoreSubject(row);
      return { ...row, verdict, score, breakdown };
    });

    rows.sort((a, b) => a.title.localeCompare(b.title));
    return { generatedAt: new Date().toISOString(), rows };
  }

  /**
   * Deterministic curriculum-health score (0–8) from live data, so the verdict can be
   * recomputed any time and explained per criterion. Strong >= 6, Mixed 2–5, Weak <= 1.
   */
  private scoreSubject(r: Omit<SubjectMatrixRow, 'verdict' | 'score' | 'breakdown'>): {
    verdict: SubjectVerdict; score: number; breakdown: SubjectVerdictBreakdown;
  } {
    const breakdown: SubjectVerdictBreakdown = { depth: 0, lessons: 0, interview: 0, ladder: 0, entryCert: 0 };
    if (!r.topics) return { verdict: 'empty', score: 0, breakdown };

    breakdown.depth = r.perTopicMedian >= 15 ? 2 : r.perTopicMedian >= 10 ? 1 : 0;
    const lessonShare = r.topicsWithLesson / r.topics;
    breakdown.lessons = lessonShare >= 0.8 ? 2 : lessonShare >= 0.4 ? 1 : 0;
    const interviewPerTopic = r.activeInterview / r.topics;
    breakdown.interview = interviewPerTopic >= 3 ? 2 : interviewPerTopic > 0 ? 1 : 0;
    breakdown.ladder = r.subjectTracks >= 3 && r.topicsWithoutTrack === 0 ? 1 : 0;
    breakdown.entryCert = (r.entryCert?.correctAnswersToEarn ?? 0) >= 50 ? 1 : 0;

    const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const verdict: SubjectVerdict = score >= 6 ? 'strong' : score >= 2 ? 'mixed' : 'weak';
    return { verdict, score, breakdown };
  }
}
