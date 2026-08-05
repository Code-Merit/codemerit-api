import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CERT_ACHIEVED } from 'src/common/constants/completion-thresholds';
import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { CertificateStatusEnum } from 'src/common/enum/certificate-status.enum';
import { InterviewStatusEnum } from 'src/common/enum/interview-status.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { Interview } from 'src/common/typeorm/entities/interview.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserBadge } from 'src/common/typeorm/entities/user-badge.entity';
import { computeAttemptMetrics, generateScore, getAggregateUserLevel } from 'src/common/utils/common-functions';
import { DataSource, Repository } from 'typeorm';
import { MeritService } from './merit.service';
import { SubjectStatsService } from './subject-stats.service';
import { TopicAnalysisService } from './topic-analysis.service';
import { SubjectTrackAnalysisService } from './subject-track-analysis.service';
import { BadgeQueryService, ScopedBadgeDto } from '../../achievement/providers/badge-query.service';

@Injectable()
export class ProgramService {
  constructor(
    @InjectRepository(JobRole)
    private readonly jobRoleRepo: Repository<JobRole>,

    @InjectRepository(SubjectTrack)
    private readonly subjectTrackRepo: Repository<SubjectTrack>,

    private readonly dataSource: DataSource,
    private readonly subjectStats: SubjectStatsService,
    private readonly topicAnalyzer: TopicAnalysisService,
    private readonly meritService: MeritService,
    private readonly subjectTrackAnalyzer: SubjectTrackAnalysisService,
    private readonly badgeQueryService: BadgeQueryService,
  ) {}

  // ─── "Next best action" surfacing ─────────────────────────────────────────────

  /**
   * Given a job role's (or program's) already-assembled certificationTracks
   * cards (each with progressPercent/isAchieved and subjectTracks with their
   * own progressPercent/isCompleted), picks the single closest-to-completion
   * not-yet-achieved cert track, and within it the closest-to-completion
   * not-yet-completed subject track — so a dashboard can surface a concrete
   * "you're closest to earning X, do Y next" instead of a static list.
   */
  private pickNextBestAction(certificationTracks: any[]): {
    nextCertificationTrack: any | null;
    nextSubjectTrack: any | null;
  } {
    const inProgress = certificationTracks
      .filter((ct) => !ct.isAchieved)
      .sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0));

    const nextCt = inProgress[0] ?? null;
    if (!nextCt) return { nextCertificationTrack: null, nextSubjectTrack: null };

    const incompleteTracks = (nextCt.subjectTracks ?? [])
      .filter((st: any) => !st.isCompleted)
      .sort((a: any, b: any) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0));

    const nextSt = incompleteTracks[0] ?? null;

    return {
      nextCertificationTrack: {
        id: nextCt.id, title: nextCt.title, progressPercent: nextCt.progressPercent,
      },
      nextSubjectTrack: nextSt
        ? {
            id: nextSt.id, title: nextSt.title, progressPercent: nextSt.progressPercent,
            // Lets a dashboard launch a quiz directly against the underlying subject instead
            // of just pointing at the subjectTrack. subjectTracks carry a nested `subject`
            // on the enriched/program-detail call sites; the legacy getCareerDashboard call
            // site only has flat subjectId/subjectName (no slug) — subjectSlug stays null there.
            subjectId: nextSt.subject?.id ?? nextSt.subjectId ?? null,
            subjectTitle: nextSt.subject?.title ?? nextSt.subjectName ?? null,
            subjectSlug: nextSt.subject?.slug ?? null,
          }
        : null,
    };
  }

  // ─── Shared Private Fetchers ──────────────────────────────────────────────────

  private async fetchJobRoleBySlug(slug: string) {
    const jr = await this.jobRoleRepo.findOne({
      where: { slug, isPublished: true },
      select: ['id', 'title', 'slug', 'image', 'color', 'description', 'body', 'scope'],
    });
    if (!jr) throw new NotFoundException('Program not found');
    return jr;
  }

  private async fetchUserJobRoles(userId: number) {
    return this.dataSource
      .createQueryBuilder()
      .select('jr.id', 'id')
      .addSelect('jr.title', 'title')
      .addSelect('jr.slug', 'slug')
      .addSelect('jr.image', 'image')
      .addSelect('jr.color', 'color')
      .addSelect('jr.description', 'description')
      .addSelect('jr.scope', 'scope')
      .addSelect('jr.orderId', 'orderId')
      .addSelect('ujr.createdAt', 'enrolledAt')
      .from(JobRole, 'jr')
      .innerJoin('user_job_role', 'ujr', 'ujr.jobRoleId = jr.id')
      .where('ujr.userId = :userId', { userId })
      .andWhere('jr.isPublished = 1')
      .orderBy('jr.orderId', 'ASC')
      .getRawMany();
  }

  // ─── User performance stats (career-dashboard summary) ────────────────────────

  /** Whole-account totals — deliberately not scoped to this user's enrolled job roles, since
   * badges/certificates earned via one role are still part of the learner's overall record. */
  private async fetchUserBadgeAndCertificateTotals(userId: number) {
    const [badgeRow, certRow] = await Promise.all([
      this.dataSource
        .createQueryBuilder()
        .select('COUNT(ub.id)', 'count')
        .from(UserBadge, 'ub')
        .where('ub.userId = :userId', { userId })
        .getRawOne(),
      this.dataSource
        .createQueryBuilder()
        .select('COUNT(c.id)', 'count')
        .from(Certificate, 'c')
        .where('c.userId = :userId', { userId })
        .andWhere('c.status = :status', { status: CertificateStatusEnum.ISSUED })
        .getRawOne(),
    ]);
    return {
      totalBadgesEarned: +(badgeRow?.count ?? 0),
      totalCertificatesIssued: +(certRow?.count ?? 0),
    };
  }

  /** Formally issued certificates for the given cert tracks — distinct from
   * certificationTracks[].isAchieved (which is just progress crossing CERT_ACHIEVED); a track
   * can be 100% complete without a Certificate row yet existing if issuance is a separate step. */
  private async fetchCertificatesForTracks(userId: number, certificationTrackIds: number[]) {
    const map = new Map<number, { certificateNumber: string; status: string; issuedAt: Date; expiresAt: Date | null }>();
    if (!certificationTrackIds.length) return map;
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('c.certificationTrackId', 'certificationTrackId')
      .addSelect('c.certificateNumber', 'certificateNumber')
      .addSelect('c.status', 'status')
      .addSelect('c.issuedAt', 'issuedAt')
      .addSelect('c.expiresAt', 'expiresAt')
      .from(Certificate, 'c')
      .where('c.userId = :userId', { userId })
      .andWhere('c.certificationTrackId IN (:...certificationTrackIds)', { certificationTrackIds })
      .getRawMany();
    for (const r of rows) {
      map.set(+r.certificationTrackId, {
        certificateNumber: r.certificateNumber,
        status: r.status,
        issuedAt: r.issuedAt,
        expiresAt: r.expiresAt ?? null,
      });
    }
    return map;
  }

  /** Interview activity per job role (Interview.jobRoleId), for the "readiness" story SME/manager
   * interviews add on top of quiz-based scoring. `upcoming` requires both SCHEDULED status and a
   * still-future scheduledAt, since a SCHEDULED round whose time has simply passed isn't upcoming. */
  private async fetchInterviewStatsByJobRole(userId: number, jobRoleIds: number[]) {
    const map = new Map<number, {
      total: number; completed: number; upcoming: number;
      lastStatus: string | null; lastScheduledAt: Date | null;
    }>();
    if (!jobRoleIds.length) return map;

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('i.jobRoleId', 'jobRoleId')
      .addSelect('i.status', 'status')
      .addSelect('i.scheduledAt', 'scheduledAt')
      .from(Interview, 'i')
      .where('i.userId = :userId', { userId })
      .andWhere('i.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
      .orderBy('i.scheduledAt', 'DESC')
      .getRawMany();

    const now = new Date();
    for (const row of rows) {
      const jrId = +row.jobRoleId;
      const entry = map.get(jrId) ?? { total: 0, completed: 0, upcoming: 0, lastStatus: null, lastScheduledAt: null };
      entry.total++;
      if (row.status === InterviewStatusEnum.COMPLETED) entry.completed++;
      if (row.status === InterviewStatusEnum.SCHEDULED && new Date(row.scheduledAt) > now) entry.upcoming++;
      // Rows arrive scheduledAt DESC, so the first one seen per jobRoleId is the most recent.
      if (!entry.lastScheduledAt) {
        entry.lastStatus = row.status;
        entry.lastScheduledAt = row.scheduledAt;
      }
      map.set(jrId, entry);
    }
    return map;
  }

  /** Interview *quality* signal, separate from the status counts above — the average
   * SkillRating.rating (0–5 scale) across all rounds of this role's interviews, plus how many
   * distinct rounds actually got rated (a completed/cancelled round may have no ratings at all).
   * Numeric only; the "No interview taken" / "Rated X in Y interviews" style message is left to
   * the frontend to compose from these fields plus the status counts. */
  private async fetchInterviewRatingsByJobRole(userId: number, jobRoleIds: number[]) {
    const map = new Map<number, { averageRating: number | null; ratedInterviewCount: number }>();
    if (!jobRoleIds.length) return map;

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('i.jobRoleId', 'jobRoleId')
      .addSelect('AVG(sr.rating)', 'avgRating')
      .addSelect('COUNT(DISTINCT sr.assessmentSessionId)', 'ratedSessions')
      .from(Interview, 'i')
      .innerJoin('assessment_session', 'ases', 'ases.interviewId = i.id')
      .innerJoin('skill_rating', 'sr', 'sr.assessmentSessionId = ases.id')
      .where('i.userId = :userId', { userId })
      .andWhere('i.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
      .groupBy('i.jobRoleId')
      .getRawMany();

    for (const r of rows) {
      map.set(+r.jobRoleId, {
        averageRating: r.avgRating != null ? +(+r.avgRating).toFixed(1) : null,
        ratedInterviewCount: +r.ratedSessions || 0,
      });
    }
    return map;
  }

  /** How many other learners are pursuing each role — single grouped query for every enrolled
   * role at once rather than one COUNT per role. */
  private async fetchJobRoleLearnerCounts(jobRoleIds: number[]) {
    const map = new Map<number, number>();
    if (!jobRoleIds.length) return map;
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('ujr.jobRoleId', 'jobRoleId')
      .addSelect('COUNT(ujr.id)', 'count')
      .from('user_job_role', 'ujr')
      .where('ujr.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
      .groupBy('ujr.jobRoleId')
      .getRawMany();
    for (const r of rows) map.set(+r.jobRoleId, +r.count);
    return map;
  }

  /** Minutes spent answering this role's subjects' trivia questions — summed over every attempt
   * ever (retries included), same "journey" convention as journeyAccuracy elsewhere, since time
   * invested is about effort, not just the latest/best attempt. One grouped query across every
   * enrolled role via job_role_subject, not one query per role. Note: a subject shared by two
   * enrolled roles has its time counted under both — same double-counting convention already
   * used for score/accuracy elsewhere on this dashboard. */
  private async fetchTimeInvestedByJobRole(userId: number, jobRoleIds: number[]) {
    const map = new Map<number, number>();
    if (!jobRoleIds.length) return map;
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('jrs.jobRoleId', 'jobRoleId')
      .addSelect('COALESCE(SUM(qa.timeTaken), 0)', 'totalSeconds')
      .from('job_role_subject', 'jrs')
      .innerJoin(
        'question', 'q',
        'q.subjectId = jrs.subjectId AND q.status = :active AND q.questionType = :trivia',
        { active: QuestionStatusEnum.Active, trivia: QuestionTypeEnum.Trivia },
      )
      .innerJoin('question_attempt', 'qa', 'qa.questionId = q.id AND qa.userId = :userId', { userId })
      .where('jrs.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
      .groupBy('jrs.jobRoleId')
      .getRawMany();
    for (const r of rows) map.set(+r.jobRoleId, Math.round((+r.totalSeconds || 0) / 60));
    return map;
  }

  private async fetchRoleSubjects(jobRoleIds: number[]) {
    return this.dataSource
      .createQueryBuilder()
      .select('jrs.jobRoleId', 'jobRoleId')
      .addSelect('jrs.subjectId', 'subjectId')
      .addSelect('jrs.tag', 'tag')
      .addSelect('jrs.sortOrder', 'sortOrder')
      .addSelect('s.title', 'sTitle')
      .addSelect('s.slug', 'sSlug')
      .addSelect('s.color', 'sColor')
      .addSelect('s.image', 'sImage')
      .addSelect('s.description', 'sDescription')
      .from('job_role_subject', 'jrs')
      .innerJoin('subject', 's', 's.id = jrs.subjectId AND s.isPublished = 1')
      .where('jrs.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
      .orderBy('jrs.jobRoleId', 'ASC')
      .addOrderBy('jrs.sortOrder', 'ASC')
      .getRawMany();
  }

  /**
   * Cert tracks for the given job role IDs, each row = one (cert, subjectTrack) pair.
   * A certification can be associated with multiple job roles via certification_track_job_role
   * (sortOrder/isPublished/an optional descriptionOverride are per-role; the composition — which
   * subject tracks count toward it — is shared and lives once on certification_track).
   */
  private async fetchCertTrackHierarchy(jobRoleIds: number[]) {
    if (!jobRoleIds.length) return [];
    return this.dataSource
      .createQueryBuilder()
      .select('ct.id', 'ctId')
      .addSelect('ct.title', 'ctTitle')
      .addSelect('COALESCE(ctjr.descriptionOverride, ct.description)', 'ctDesc')
      .addSelect('ctjr.sortOrder', 'ctSortOrder')
      .addSelect('ctjr.jobRoleId', 'ctJobRoleId')
      .addSelect('st.id', 'stId')
      .addSelect('st.title', 'stTitle')
      .addSelect('st.slug', 'stSlug')
      .addSelect('st.sortOrder', 'stSortOrder')
      .addSelect('st.subjectId', 'stSubjectId')
      .addSelect('s.title', 'stSubjectTitle')
      .addSelect('s.slug', 'stSubjectSlug')
      .from('certification_track', 'ct')
      .innerJoin('certification_track_job_role', 'ctjr', 'ctjr.certificationTrackId = ct.id')
      .innerJoin('certification_track_subject_track', 'ctst', 'ctst.certificationTrackId = ct.id')
      .innerJoin('subject_track', 'st', 'st.id = ctst.subjectTrackId AND st.isPublished = 1')
      .innerJoin('subject', 's', 's.id = st.subjectId')
      .where('ctjr.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
      .andWhere('ctjr.isPublished = 1')
      .orderBy('ctjr.jobRoleId', 'ASC')
      .addOrderBy('ctjr.sortOrder', 'ASC')
      .addOrderBy('st.sortOrder', 'ASC')
      .getRawMany();
  }

  // ─── Job Roles With Subjects (master data) ────────────────────────────────────

  async getJobRolesWithSubjects(userId?: number) {
    const qb = this.jobRoleRepo
      .createQueryBuilder('jobRole')
      .leftJoinAndSelect('jobRole.jobRoleSubjects', 'jrs')
      .leftJoinAndSelect('jrs.subject', 'subject')
      .select([
        'jobRole.id', 'jobRole.title', 'jobRole.slug', 'jobRole.description',
        'jobRole.image', 'jobRole.isPublished', 'jobRole.color',
        'jrs.id', 'subject.id', 'subject.title', 'subject.slug', 'subject.image',
      ])
      .where('jobRole.isPublished = :isPublished', { isPublished: 1 })
      .orderBy('jobRole.orderId', 'ASC');

    if (userId) {
      qb.addSelect(`CASE WHEN usr.id = :userId THEN 1 ELSE 0 END`, 'isSubscribed')
        .leftJoin(User, 'usr', 'usr.id = :userId', { userId });
    } else {
      qb.addSelect('FALSE', 'isSubscribed');
    }

    const [certCounts, stCounts, { raw: rawRows, entities }] = await Promise.all([
      this.dataSource
        .createQueryBuilder()
        .select('ctjr.jobRoleId', 'jobRoleId')
        .addSelect('COUNT(ctjr.id)', 'count')
        .from('certification_track_job_role', 'ctjr')
        .groupBy('ctjr.jobRoleId')
        .getRawMany()
        .then((rows) => new Map(rows.map((r) => [+r.jobRoleId, +r.count]))),
      this.subjectTrackRepo
        .createQueryBuilder('st')
        .select('st.subjectId', 'subjectId')
        .addSelect('COUNT(st.id)', 'count')
        .groupBy('st.subjectId')
        .getRawMany()
        .then((rows) => new Map(rows.map((r) => [+r.subjectId, +r.count]))),
      qb.getRawAndEntities(),
    ]);

    const rawById = new Map<number, any>();
    for (const r of rawRows) {
      if (!rawById.has(+r.jobRole_id)) rawById.set(+r.jobRole_id, r);
    }

    return entities.map((jr) => ({
      id: jr.id,
      title: jr.title,
      slug: jr.slug,
      description: jr.description,
      image: jr.image,
      color: jr.color,
      isPublished: jr.isPublished,
      isSubscribed: Boolean(Number(rawById.get(jr.id)?.isSubscribed)),
      certificationTrackCount: certCounts.get(jr.id) ?? 0,
      subjects: jr.jobRoleSubjects.map((jrs) => ({
        id: jrs.subject.id,
        title: jrs.subject.title,
        slug: jrs.subject.slug,
        image: jrs.subject.image,
        subjectTrackCount: stCounts.get(jrs.subject.id) ?? 0,
      })),
    }));
  }

  // ─── Career Dashboard (authenticated) ────────────────────────────────────────

  async getCareerDashboard(userId: number) {
    const jobRoles = await this.fetchUserJobRoles(userId);

    if (!jobRoles.length) {
      return {
        overallSummary: {
          totalSubjects: 0, overallReadiness: 0,
          totalCertificationTracks: 0, certTracksAchieved: 0,
          certTracksInProgress: 0, certTracksNotStarted: 0,
        },
        jobRoles: [],
      };
    }

    const jobRoleIds = jobRoles.map((jr) => +jr.id);

    const roleSubjectRows = await this.fetchRoleSubjects(jobRoleIds);

    // Parallel fetches
    const [subjectStatsMap, certRows] = await Promise.all([
      this.subjectStats.getSubjectStatsMap(userId),
      this.fetchCertTrackHierarchy(jobRoleIds),
    ]);

    // Fetch cert track topics (certRows don't have topicIds — need separate fetch)
    const certStIds = [...new Set(certRows.map((r) => +r.stId))];
    const stRowsForCerts = await this.subjectTrackAnalyzer.fetchSubjectTracksWithTopicsByIds(certStIds);

    const allCertTopicIds = [...new Set(stRowsForCerts.map((r) => +r.topicId))];
    const topicStatsList = allCertTopicIds.length
      ? await this.topicAnalyzer.getTopicStatsByIds(allCertTopicIds, userId)
      : [];
    const topicStatsMap = new Map<number, any>(topicStatsList.map((t) => [t.id, t]));

    const stMerits = await this.meritService.getSubjectTrackMasteryLeaderboards(certStIds, userId);
    const stMap = this.subjectTrackAnalyzer.buildSubjectTrackMap(stRowsForCerts, topicStatsMap, stMerits, userId);

    // Index certRows by jobRole
    type CertEntry = { meta: any; stIds: number[] };
    const certByJobRole = new Map<number, Map<number, CertEntry>>();
    for (const row of certRows) {
      const jrId = +row.ctJobRoleId;
      if (!certByJobRole.has(jrId)) certByJobRole.set(jrId, new Map());
      const certMap = certByJobRole.get(jrId)!;
      if (!certMap.has(+row.ctId)) {
        certMap.set(+row.ctId, {
          meta: { id: +row.ctId, title: row.ctTitle, description: row.ctDesc, sortOrder: +row.ctSortOrder },
          stIds: [],
        });
      }
      certMap.get(+row.ctId)!.stIds.push(+row.stId);
    }

    // Index subjects by jobRole
    const subjectsByJobRole = new Map<number, any[]>();
    for (const rs of roleSubjectRows) {
      const jrId = +rs.jobRoleId;
      if (!subjectsByJobRole.has(jrId)) subjectsByJobRole.set(jrId, []);
      const raw = subjectStatsMap.get(+rs.subjectId) ?? {};
      const attempted = +raw.attempted || 0;
      const correct = +raw.correct || 0;
      const wrong = +raw.wrong || 0;
      const skipped = +raw.skipped || 0;
      const numTrivia = +raw.numTrivia || 0;
      // computeAttemptMetrics() is the one shared implementation of this formula —
      // every level (subject/topic/subjectTrack/job-role) calls it instead of reimplementing it.
      const { coverage, correctCoverage, currentAccuracy: accuracy, score } = computeAttemptMetrics({
        numTrivia, attempted, correct, wrong,
        journeyAttempts: +raw.journeyAttempts || 0,
        journeyCorrect: +raw.journeyCorrect || 0,
        journeyWrong: +raw.journeyWrong || 0,
      });
      const attemptedEasy = +raw.attemptedEasy || 0;
      const attemptedMedium = +raw.attemptedMedium || 0;
      const attemptedHard = +raw.attemptedHard || 0;
      const correctEasy = +raw.correctEasy || 0;
      const correctMedium = +raw.correctMedium || 0;
      const correctHard = +raw.correctHard || 0;
      subjectsByJobRole.get(jrId)!.push({
        id: +rs.subjectId, title: rs.sTitle, slug: rs.sSlug, color: rs.sColor,
        image: rs.sImage, tag: rs.tag, sortOrder: +rs.sortOrder,
        isSubscribed: raw.isSubscribed === 1 || raw.isSubscribed === '1',
        numQuestions: +raw.numQuestions || 0, numTrivia,
        attempted, correct, wrong, skipped, accuracy, coverage, score,
        attemptedEasy, attemptedMedium, attemptedHard,
        correctEasy, correctMedium, correctHard,
        wrongEasy: +raw.wrongEasy || 0,
        wrongMedium: +raw.wrongMedium || 0,
        wrongHard: +raw.wrongHard || 0,
        userLevel: getAggregateUserLevel(
          attemptedEasy, correctEasy,
          attemptedMedium, correctMedium,
          attemptedHard, correctHard,
          correctCoverage,
        ),
      });
    }

    // Assemble
    let totalSubjects = 0, totalCerts = 0, certsAchieved = 0, certsInProgress = 0;
    // Pooled (not averaged) across every scoreSrc subject across every job role — sum raw
    // counts first, one generateScore() call at the end. Averaging per-subject scores instead
    // would silently weight a subject with 2 questions the same as one with 200.
    let readinessAttempted = 0, readinessCorrect = 0, readinessWrong = 0;

    const jobRoleDashboards = jobRoles.map((jr) => {
      const subjects = subjectsByJobRole.get(+jr.id) ?? [];
      totalSubjects += subjects.length;

      const mandatory = subjects.filter((s) => s.tag === 'MANDATORY');
      const scoreSrc = mandatory.length ? mandatory : subjects;
      const jrAttempted = scoreSrc.reduce((s: number, sub: any) => s + sub.attempted, 0);
      const jrCorrect = scoreSrc.reduce((s: number, sub: any) => s + sub.correct, 0);
      const jrWrong = scoreSrc.reduce((s: number, sub: any) => s + sub.wrong, 0);
      const readinessScore = +generateScore(jrAttempted, jrCorrect, jrWrong).toFixed(0);
      readinessAttempted += jrAttempted;
      readinessCorrect += jrCorrect;
      readinessWrong += jrWrong;

      const certMap = certByJobRole.get(+jr.id) ?? new Map<number, CertEntry>();
      const certificationTracks = [...certMap.values()].map(({ meta: ct, stIds }) => {
        const subjectTracks = [...new Set(stIds)].map((stId) => stMap.get(stId)).filter(Boolean);
        const total = subjectTracks.length;
        const completed = subjectTracks.filter((st: any) => st.isCompleted).length;
        const progressPercent = total > 0 ? +((completed / total) * 100).toFixed(0) : 0;
        const isAchieved = progressPercent >= CERT_ACHIEVED;

        totalCerts++;
        if (isAchieved) certsAchieved++;
        else if (completed > 0) certsInProgress++;

        return {
          ...ct,
          totalSubjectTracks: total, completedSubjectTracks: completed,
          progressPercent, isAchieved, achievementThreshold: CERT_ACHIEVED,
          subjectTracks,
        };
      });

      const { nextCertificationTrack, nextSubjectTrack } = this.pickNextBestAction(certificationTracks);

      return {
        id: +jr.id, title: jr.title, slug: jr.slug, image: jr.image,
        color: jr.color, description: jr.description,
        readinessScore, subjects, certificationTracks,
        nextCertificationTrack, nextSubjectTrack,
      };
    });

    const overallReadiness = +generateScore(readinessAttempted, readinessCorrect, readinessWrong).toFixed(0);

    return {
      overallSummary: {
        totalSubjects, overallReadiness,
        totalCertificationTracks: totalCerts,
        certTracksAchieved: certsAchieved,
        certTracksInProgress: certsInProgress,
        certTracksNotStarted: totalCerts - certsAchieved - certsInProgress,
      },
      jobRoles: jobRoleDashboards,
    };
  }

  // ─── Enriched Career Dashboard (authenticated) ───────────────────────────────

  private emptyEnrichedDashboard() {
    return {
      summary: {
        totalJobRoles: 0, totalSubjects: 0,
        totalLessons: 0, completedLessons: 0, lessonCompletion: 0,
        totalCertTracks: 0, certTracksAchieved: 0, certTracksInProgress: 0, certTracksNotStarted: 0,
        overallScore: 0, overallAccuracy: 0, overallTriviaCompletion: 0,
        totalBadgesEarned: 0, totalCertificatesIssued: 0,
      },
      lessons: [],
      jobRoles: [],
    };
  }

  async getEnrichedCareerDashboard(userId: number) {
    try {
      return await this.buildEnrichedCareerDashboard(userId);
    } catch (err) {
      console.error('[getEnrichedCareerDashboard] Unexpected error for userId', userId, err?.message ?? err);
      return this.emptyEnrichedDashboard();
    }
  }

  private async buildEnrichedCareerDashboard(userId: number) {
    const jobRoles = await this.fetchUserJobRoles(userId);

    if (!jobRoles.length) {
      return this.emptyEnrichedDashboard();
    }

    const jobRoleIds = jobRoles.map((jr) => +jr.id);
    const roleSubjectRows = await this.fetchRoleSubjects(jobRoleIds);
    const allSubjectIds = [...new Set(roleSubjectRows.map((rs) => +rs.subjectId))];

    const [
      subjectStatsMap, certRows, lessons, badgesByRole, badgeCertTotals, interviewsByRole,
      interviewRatingsByRole, learnerCountsByRole, timeInvestedByRole, jobRoleMastery,
    ] = await Promise.all([
      this.subjectStats.getSubjectStatsMap(userId),
      this.fetchCertTrackHierarchy(jobRoleIds),
      this.fetchLessonsForSubjects(allSubjectIds, userId),
      Promise.all(
        jobRoleIds.map((jrId) =>
          this.badgeQueryService
            .getUserBadgesForScope(BadgeScopeEnum.JOBROLE, jrId, userId)
            .then((badges): [number, ScopedBadgeDto[]] => [jrId, badges ?? []])
            .catch((): [number, ScopedBadgeDto[]] => [jrId, []]),
        ),
      ).then((entries) => new Map(entries)),
      this.fetchUserBadgeAndCertificateTotals(userId),
      this.fetchInterviewStatsByJobRole(userId, jobRoleIds),
      this.fetchInterviewRatingsByJobRole(userId, jobRoleIds),
      this.fetchJobRoleLearnerCounts(jobRoleIds),
      this.fetchTimeInvestedByJobRole(userId, jobRoleIds),
      this.meritService.getJobRoleMasteryLeaderboards(jobRoleIds, userId),
    ]);

    const certTrackIds = [...new Set(certRows.map((r) => +r.ctId))];
    const certificatesByTrack = await this.fetchCertificatesForTracks(userId, certTrackIds);

    // Build subject-track map needed for cert progress (mirrors getCareerDashboard exactly;
    // fetchSubjectTracksWithTopicsByIds and getSubjectTrackMasteryLeaderboards both handle empty arrays)
    const certStIds = [...new Set(certRows.map((r) => +r.stId))];
    const stRowsForCerts = await this.subjectTrackAnalyzer.fetchSubjectTracksWithTopicsByIds(certStIds);
    const allCertTopicIds = [...new Set(stRowsForCerts.map((r) => +r.topicId))];
    const topicStatsList = allCertTopicIds.length
      ? await this.topicAnalyzer.getTopicStatsByIds(allCertTopicIds, userId)
      : [];
    const topicStatsMap = new Map<number, any>(topicStatsList.map((t) => [t.id, t]));
    const stMerits = await this.meritService.getSubjectTrackMasteryLeaderboards(certStIds, userId);
    const stMap = this.subjectTrackAnalyzer.buildSubjectTrackMap(stRowsForCerts, topicStatsMap, stMerits, userId);

    // Cert rows indexed by job role
    type CertEntry = { meta: any; stIds: number[] };
    const certByJobRole = new Map<number, Map<number, CertEntry>>();
    for (const row of certRows) {
      const jrId = +row.ctJobRoleId;
      if (!certByJobRole.has(jrId)) certByJobRole.set(jrId, new Map());
      const certMap = certByJobRole.get(jrId)!;
      if (!certMap.has(+row.ctId)) {
        certMap.set(+row.ctId, {
          meta: { id: +row.ctId, title: row.ctTitle, description: row.ctDesc, sortOrder: +row.ctSortOrder },
          stIds: [],
        });
      }
      certMap.get(+row.ctId)!.stIds.push(+row.stId);
    }

    // Lesson completion counts per subject
    const lessonTotalBySubject = new Map<number, number>();
    const lessonCompletedBySubject = new Map<number, number>();
    for (const l of lessons) {
      lessonTotalBySubject.set(l.subjectId, (lessonTotalBySubject.get(l.subjectId) ?? 0) + 1);
      if (l.status === 'Completed') {
        lessonCompletedBySubject.set(l.subjectId, (lessonCompletedBySubject.get(l.subjectId) ?? 0) + 1);
      }
    }

    // Subjects per job role — used both to compute the role-level aggregates below and
    // (with title/slug/image/score attached) returned as-is so the dashboard can show a
    // per-subject breakdown, not just the job-role rollup.
    const subjectsByJobRole = new Map<number, any[]>();
    for (const rs of roleSubjectRows) {
      const jrId = +rs.jobRoleId;
      if (!subjectsByJobRole.has(jrId)) subjectsByJobRole.set(jrId, []);
      const raw = subjectStatsMap.get(+rs.subjectId) ?? {};
      const attempted = +raw.attempted || 0;
      const correct = +raw.correct || 0;
      const wrong = +raw.wrong || 0;
      const numTrivia = +raw.numTrivia || 0;
      const attemptedEasy = +raw.attemptedEasy || 0;
      const attemptedMedium = +raw.attemptedMedium || 0;
      const attemptedHard = +raw.attemptedHard || 0;
      const correctEasy = +raw.correctEasy || 0;
      const correctMedium = +raw.correctMedium || 0;
      const correctHard = +raw.correctHard || 0;
      const numEasyTrivia = +raw.numEasyTrivia || 0;
      const numIntTrivia = +raw.numIntTrivia || 0;
      const numAdvTrivia = +raw.numAdvTrivia || 0;
      // computeAttemptMetrics() is the one shared implementation of this formula —
      // every level (subject/topic/subjectTrack/job-role) calls it instead of reimplementing it.
      const { coverage, correctCoverage, currentAccuracy: accuracy, score } = computeAttemptMetrics({
        numTrivia, attempted, correct, wrong,
        journeyAttempts: +raw.journeyAttempts || 0,
        journeyCorrect: +raw.journeyCorrect || 0,
        journeyWrong: +raw.journeyWrong || 0,
      });
      // Coverage per difficulty band — how much of each band the learner has actually
      // attempted, distinct from `coverage` above which blends all three bands together.
      const easyCoverage = numEasyTrivia > 0 ? +((attemptedEasy / numEasyTrivia) * 100).toFixed(1) : 0;
      const intCoverage = numIntTrivia > 0 ? +((attemptedMedium / numIntTrivia) * 100).toFixed(1) : 0;
      const advCoverage = numAdvTrivia > 0 ? +((attemptedHard / numAdvTrivia) * 100).toFixed(1) : 0;
      const lessonTotal = lessonTotalBySubject.get(+rs.subjectId) ?? 0;
      const lessonCompleted = lessonCompletedBySubject.get(+rs.subjectId) ?? 0;
      subjectsByJobRole.get(jrId)!.push({
        id: +rs.subjectId, title: rs.sTitle, slug: rs.sSlug, image: rs.sImage,
        color: rs.sColor, tag: rs.tag, sortOrder: +rs.sortOrder,
        score, accuracy,
        coverage, correctCoverage, easyCoverage, intCoverage, advCoverage,
        userLevel: getAggregateUserLevel(
          attemptedEasy, correctEasy, attemptedMedium, correctMedium, attemptedHard, correctHard, correctCoverage,
        ),
        lessonCompletion: lessonTotal > 0 ? +((lessonCompleted / lessonTotal) * 100).toFixed(1) : 0,
        attempted, correct, wrong, numTrivia,
        attemptedEasy, attemptedMedium, attemptedHard,
        correctEasy, correctMedium, correctHard,
        lessonTotal, lessonCompleted,
      });
    }

    // Assemble per-job-role dashboards; accumulate cross-role totals
    let totalSubjects = 0, totalCertTracks = 0, certTracksAchieved = 0, certTracksInProgress = 0;

    const jobRoleDashboards = jobRoles.map((jr) => {
      const subjects = subjectsByJobRole.get(+jr.id) ?? [];
      totalSubjects += subjects.length;

      // Job-role level trivia metrics (weighted totals, not average of averages)
      const jrTotalAttempted = subjects.reduce((s: number, sub: any) => s + sub.attempted, 0);
      const jrTotalCorrect = subjects.reduce((s: number, sub: any) => s + sub.correct, 0);
      const jrTotalNumTrivia = subjects.reduce((s: number, sub: any) => s + sub.numTrivia, 0);
      const jrAccuracy = jrTotalAttempted > 0 ? +(jrTotalCorrect * 100 / jrTotalAttempted).toFixed(1) : 0;
      const jrTriviaCompletion = jrTotalNumTrivia > 0 ? +((jrTotalAttempted / jrTotalNumTrivia) * 100).toFixed(1) : 0;

      // Score: pooled over MANDATORY subjects (fallback: all subjects) — sum raw counts
      // first, one generateScore() call, same pooling jrAccuracy above already uses.
      const mandatory = subjects.filter((s: any) => s.tag === 'MANDATORY');
      const scoreSrc = mandatory.length ? mandatory : subjects;
      const jrScoreAttempted = scoreSrc.reduce((s: number, sub: any) => s + sub.attempted, 0);
      const jrScoreCorrect = scoreSrc.reduce((s: number, sub: any) => s + sub.correct, 0);
      const jrScoreWrong = scoreSrc.reduce((s: number, sub: any) => s + sub.wrong, 0);
      const jrScore = +generateScore(jrScoreAttempted, jrScoreCorrect, jrScoreWrong).toFixed(0);

      // Lesson completion
      const jrLessonTotal = subjects.reduce((s: number, sub: any) => s + sub.lessonTotal, 0);
      const jrLessonCompleted = subjects.reduce((s: number, sub: any) => s + sub.lessonCompleted, 0);
      const jrLessonCompletion = jrLessonTotal > 0 ? +((jrLessonCompleted / jrLessonTotal) * 100).toFixed(1) : 0;

      // userLevel from aggregated difficulty-band attempts across all subjects in this role
      const jrCorrectCoverage = jrTotalNumTrivia > 0 ? +((jrTotalCorrect / jrTotalNumTrivia) * 100).toFixed(1) : 0;
      const jrUserLevel = getAggregateUserLevel(
        subjects.reduce((s: number, sub: any) => s + sub.attemptedEasy, 0),
        subjects.reduce((s: number, sub: any) => s + sub.correctEasy, 0),
        subjects.reduce((s: number, sub: any) => s + sub.attemptedMedium, 0),
        subjects.reduce((s: number, sub: any) => s + sub.correctMedium, 0),
        subjects.reduce((s: number, sub: any) => s + sub.attemptedHard, 0),
        subjects.reduce((s: number, sub: any) => s + sub.correctHard, 0),
        jrCorrectCoverage,
      );

      // Cert tracks — subject tracks are light copies (no topic detail) to keep the dashboard lean
      const certMap = certByJobRole.get(+jr.id) ?? new Map<number, CertEntry>();
      let jrCertsAchieved = 0, jrCertsInProgress = 0;
      const certificationTracks = [...certMap.values()].map(({ meta: ct, stIds }) => {
        const subjectTracks = [...new Set(stIds)].map((stId) => {
          const full = stMap.get(stId);
          if (!full) return null;
          const row = certRows.find((r) => +r.stId === stId && +r.ctJobRoleId === +jr.id);
          return {
            id: full.id,
            title: full.title ?? '',
            slug: full.slug ?? '',
            sortOrder: full.sortOrder ?? 0,
            totalTopics: full.totalTopics ?? 0,
            subject: row
              ? { id: +(row.stSubjectId ?? 0), title: row.stSubjectTitle ?? '', slug: row.stSubjectSlug ?? '' }
              : null,
            progressPercent: full.progressPercent ?? 0,
            isCompleted: full.isCompleted ?? false,
          };
        }).filter(Boolean);

        const total = subjectTracks.length;
        const completed = subjectTracks.filter((st: any) => st.isCompleted).length;
        const progressPercent = total > 0 ? +((completed / total) * 100).toFixed(0) : 0;
        const isAchieved = progressPercent >= CERT_ACHIEVED;

        totalCertTracks++;
        if (isAchieved) { certTracksAchieved++; jrCertsAchieved++; }
        else if (completed > 0) { certTracksInProgress++; jrCertsInProgress++; }

        return {
          ...ct,
          totalSubjectTracks: total, completedSubjectTracks: completed,
          progressPercent, isAchieved, achievementThreshold: CERT_ACHIEVED,
          subjectTracks,
          // Formal issuance record, distinct from isAchieved above (progress can hit 100%
          // before a Certificate row is actually created) — null until one exists.
          certificate: certificatesByTrack.get(+ct.id) ?? null,
        };
      });

      const { nextCertificationTrack, nextSubjectTrack } = this.pickNextBestAction(certificationTracks);

      // Positive counterpart to nextSubjectTrack above — the subject they're already best at,
      // not the one closest to done. Only considers subjects with at least one attempt, since
      // generateScore() returns 0 for untouched subjects (that's "no data", not "weakest").
      const attemptedSubjects = subjects.filter((s: any) => s.attempted > 0);
      const strongestSubject = attemptedSubjects.length
        ? [...attemptedSubjects].sort((a: any, b: any) => b.score - a.score)[0]
        : null;

      const roleBadges = badgesByRole.get(+jr.id) ?? [];
      const peerRank = jobRoleMastery.userRanks.get(+jr.id) ?? null;

      // Public per-subject breakdown — same subjects used to compute jrScore/jrAccuracy
      // above, just stripped of the raw counters (attempted/correct/wrong/etc.) that only
      // matter for those aggregates, sorted the same way the subject picker orders them.
      const subjectsOut = [...subjects]
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        .map((s: any) => ({
          id: s.id, title: s.title, slug: s.slug, image: s.image, color: s.color,
          tag: s.tag, score: s.score, accuracy: s.accuracy, coverage: s.coverage,
          correctCoverage: s.correctCoverage, userLevel: s.userLevel, lessonCompletion: s.lessonCompletion,
          easyCoverage: s.easyCoverage, intCoverage: s.intCoverage, advCoverage: s.advCoverage,
        }));

      return {
        id: +jr.id, title: jr.title, slug: jr.slug,
        image: jr.image, color: jr.color, description: jr.description,
        scope: jr.scope ?? null,
        enrolledAt: jr.enrolledAt ?? null,
        summary: {
          score: jrScore,
          accuracy: jrAccuracy,
          triviaCompletion: jrTriviaCompletion,
          lessonCompletion: jrLessonCompletion,
          lessonsTotal: jrLessonTotal,
          lessonsCompleted: jrLessonCompleted,
          userLevel: jrUserLevel,
          certTracksTotal: certMap.size,
          certTracksAchieved: jrCertsAchieved,
          certTracksInProgress: jrCertsInProgress,
          badgesTotal: roleBadges.length,
          badgesUnlocked: roleBadges.filter((b: any) => b.unlocked).length,
          // Minutes spent answering this role's subjects' trivia questions, all-time —
          // see fetchTimeInvestedByJobRole for the "journey" (retries-included) convention.
          timeInvestedMinutes: timeInvestedByRole.get(+jr.id) ?? 0,
          // Mastery-leaderboard rank among everyone else active in this role's subjects, and
          // how many people are formally enrolled in the role — two distinct "how do I compare"
          // signals. Both null/0 rather than omitted when there's no data yet.
          peerRank,
          totalLearners: learnerCountsByRole.get(+jr.id) ?? 0,
          // SME/manager interview activity for this role — separate signal from the
          // quiz-derived score/accuracy above. See fetchInterviewStatsByJobRole and
          // fetchInterviewRatingsByJobRole. averageRating/ratedInterviewCount are numeric only —
          // any "No interview taken" / "Rated X in Y interviews" copy is left to the frontend.
          interviews: {
            ...(interviewsByRole.get(+jr.id) ?? {
              total: 0, completed: 0, upcoming: 0, lastStatus: null, lastScheduledAt: null,
            }),
            ...(interviewRatingsByRole.get(+jr.id) ?? { averageRating: null, ratedInterviewCount: 0 }),
          },
        },
        subjects: subjectsOut,
        certificationTracks,
        badges: roleBadges,
        nextCertificationTrack,
        nextSubjectTrack,
        strongestSubject: strongestSubject
          ? {
              id: strongestSubject.id, title: strongestSubject.title, slug: strongestSubject.slug,
              image: strongestSubject.image, score: strongestSubject.score, accuracy: strongestSubject.accuracy,
            }
          : null,
      };
    });

    // Overall summary — computed from unique subjects (not double-counted per role). Pooled
    // (sum raw counts, one generateScore() call) rather than averaging each subject's score,
    // so this stays consistent with overallAccuracy right below and jrScore/jrAccuracy above.
    let sumAttempted = 0, sumCorrect = 0, sumWrong = 0, sumNumTrivia = 0;
    for (const subjectId of allSubjectIds) {
      const raw = subjectStatsMap.get(subjectId) ?? {};
      const attempted = +raw.attempted || 0;
      const correct = +raw.correct || 0;
      const wrong = +raw.wrong || 0;
      sumAttempted += attempted;
      sumCorrect += correct;
      sumWrong += wrong;
      sumNumTrivia += +raw.numTrivia || 0;
    }
    const overallScore = +generateScore(sumAttempted, sumCorrect, sumWrong).toFixed(0);
    const overallAccuracy = sumAttempted > 0 ? +(sumCorrect * 100 / sumAttempted).toFixed(1) : 0;
    const overallTriviaCompletion = sumNumTrivia > 0 ? +((sumAttempted / sumNumTrivia) * 100).toFixed(1) : 0;
    const totalLessons = lessons.length;
    const completedLessons = lessons.filter((l) => l.status === 'Completed').length;
    const lessonCompletion = totalLessons > 0 ? +((completedLessons / totalLessons) * 100).toFixed(1) : 0;

    return {
      summary: {
        totalJobRoles: jobRoles.length,
        totalSubjects,
        totalLessons,
        completedLessons,
        lessonCompletion,
        totalCertTracks,
        certTracksAchieved,
        certTracksInProgress,
        certTracksNotStarted: totalCertTracks - certTracksAchieved - certTracksInProgress,
        overallScore,
        overallAccuracy,
        overallTriviaCompletion,
        // Cross-role achievement totals — see fetchUserBadgeAndCertificateTotals.
        totalBadgesEarned: badgeCertTotals.totalBadgesEarned,
        totalCertificatesIssued: badgeCertTotals.totalCertificatesIssued,
      },
      lessons,
      jobRoles: jobRoleDashboards,
    };
  }

  // ─── Lessons for subjects (used by enriched career dashboard) ────────────────

  private async fetchLessonsForSubjects(subjectIds: number[], userId?: number) {
    if (!subjectIds.length) return [];
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('l.id', 'id')
      .addSelect('l.title', 'title')
      .addSelect('l.slug', 'slug')
      .addSelect('l.level', 'level')
      .addSelect('l.format', 'format')
      .addSelect('l.subjectId', 'subjectId')
      .addSelect('s.title', 'subjectName')
      .addSelect('l.topicId', 'topicId')
      .addSelect('t.title', 'topicTitle')
      .addSelect('t.order', 'topicOrder')
      .addSelect('COUNT(ls.id)', 'numSections')
      .addSelect('ult.status', 'status')
      .addSelect('ult.progressPercent', 'progressPercent')
      .addSelect('ult.views', 'views')
      .from('lesson', 'l')
      .innerJoin('subject', 's', 's.id = l.subjectId')
      .innerJoin('topic', 't', 't.id = l.topicId')
      .leftJoin('lesson_section', 'ls', 'ls.lessonId = l.id')
      .leftJoin('user_lesson_tracker', 'ult', 'ult.lessonId = l.id AND ult.userId = :userId', { userId: userId ?? 0 })
      .where('l.subjectId IN (:...subjectIds)', { subjectIds })
      .groupBy('l.id')
      .addGroupBy('s.title')
      .addGroupBy('t.title')
      .addGroupBy('t.order')
      .addGroupBy('ult.status')
      .addGroupBy('ult.progressPercent')
      .addGroupBy('ult.views')
      .orderBy('l.subjectId', 'ASC')
      .addOrderBy('t.order', 'ASC')
      .addOrderBy('l.level', 'ASC')
      .addOrderBy('l.id', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      id: +r.id,
      title: r.title ?? '',
      slug: r.slug ?? '',
      level: +(r.level ?? 1),
      format: r.format ?? null,
      subjectId: +(r.subjectId ?? 0),
      subjectName: r.subjectName ?? '',
      topicId: +(r.topicId ?? 0),
      topicTitle: r.topicTitle ?? '',
      topicOrder: +(r.topicOrder ?? 0),
      numSections: +(r.numSections ?? 0),
      status: r.status ?? null,
      progressPercent: r.progressPercent != null ? +(r.progressPercent) : 0,
      views: r.views != null ? +(r.views) : 0,
    }));
  }

  // ─── Program Details (public + optional auth) ─────────────────────────────────

  async getProgramDetails(slug: string, userId?: number) {
    const jobRole = await this.fetchJobRoleBySlug(slug);
    const jobRoleId = jobRole.id;

    // Fetch subjects and their full subject track + topic hierarchy in parallel
    const roleSubjectRows = await this.fetchRoleSubjects([jobRoleId]);
    const subjectIds = roleSubjectRows.map((rs) => +rs.subjectId);

    const badges = await this.badgeQueryService.getUserBadgesForScope(
      BadgeScopeEnum.JOBROLE,
      jobRoleId,
      userId,
    );

    if (!subjectIds.length) {
      return {
        jobRole: { id: jobRole.id, title: jobRole.title, slug: jobRole.slug, image: jobRole.image, color: jobRole.color, description: jobRole.description, body: (jobRole as any).body, scope: (jobRole as any).scope },
        subjects: [],
        certificationTracks: [],
        meritList: [],
        userRank: null,
        badges,
      };
    }

    const [stRows, certRows, subjectStatsMap, subjectMerits, popularTopicsMap, jobRoleMerit, subjectBadgesMap] = await Promise.all([
      this.subjectTrackAnalyzer.fetchSubjectTracksWithTopics(subjectIds),
      this.fetchCertTrackHierarchy([jobRoleId]),
      this.subjectStats.getSubjectStatsMap(userId),
      this.meritService.getSubjectMasteryLeaderboards(subjectIds, userId),
      this.meritService.getPopularTopicsBySubject(subjectIds),
      this.meritService.getJobRoleMasteryLeaderboard(subjectIds, userId),
      this.badgeQueryService.getUserBadgesGroupedBySubject(subjectIds, userId),
    ]);

    // Topic stats — fetched regardless of auth so title/slug/numTrivia are always populated;
    // attempt-derived fields simply come back zeroed for anonymous users.
    const allTopicIds = [...new Set(stRows.map((r) => +r.topicId))];
    const topicStatsList = allTopicIds.length
      ? await this.topicAnalyzer.getTopicStatsByIds(allTopicIds, userId)
      : [];
    const topicStatsMap = new Map<number, any>(topicStatsList.map((t) => [t.id, t]));

    // SubjectTrack merits
    const allStIds = [...new Set(stRows.map((r) => +r.stId))];
    const stMerits = await this.meritService.getSubjectTrackMasteryLeaderboards(allStIds, userId);

    // Build the central subjectTrack map (shared by subjects and cert views)
    const stMap = this.subjectTrackAnalyzer.buildSubjectTrackMap(stRows, topicStatsMap, stMerits, userId);

    // ── Subjects view ──────────────────────────────────────────────────────────
    // Group subject tracks by subjectId
    const stIdsBySubject = new Map<number, number[]>();
    for (const row of stRows) {
      const sid = +row.stSubjectId;
      const arr = stIdsBySubject.get(sid) || [];
      if (!arr.includes(+row.stId)) arr.push(+row.stId);
      stIdsBySubject.set(sid, arr);
    }

    const subjects = roleSubjectRows.map((rs) => {
      const raw = subjectStatsMap.get(+rs.subjectId) ?? {};
      const attempted = +raw.attempted || 0;
      const correct = +raw.correct || 0;
      const wrong = +raw.wrong || 0;
      const skipped = +raw.skipped || 0;
      const numTrivia = +raw.numTrivia || 0;
      // computeAttemptMetrics() is the one shared implementation of this formula —
      // every level (subject/topic/subjectTrack/job-role) calls it instead of reimplementing it.
      const { coverage, correctCoverage, currentAccuracy: accuracy, score } = computeAttemptMetrics({
        numTrivia, attempted, correct, wrong,
        journeyAttempts: +raw.journeyAttempts || 0,
        journeyCorrect: +raw.journeyCorrect || 0,
        journeyWrong: +raw.journeyWrong || 0,
      });

      const subjectTrackIds = stIdsBySubject.get(+rs.subjectId) ?? [];
      const subjectTracks = subjectTrackIds
        .map((stId) => stMap.get(stId))
        .filter(Boolean)
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

      const card: any = {
        id: +rs.subjectId,
        title: rs.sTitle, slug: rs.sSlug, color: rs.sColor,
        image: rs.sImage, description: rs.sDescription,
        tag: rs.tag, sortOrder: +rs.sortOrder,
        numQuestions: +raw.numQuestions || 0, numTrivia,
        meritList: subjectMerits.meritLists.get(+rs.subjectId) ?? [],
        popularTopics: popularTopicsMap.get(+rs.subjectId) ?? [],
        subjectTracks,
        // This subject's own badges (Subject-scoped, scopeId === this card's id) — always an
        // array, empty for anonymous requests, same convention as the top-level `badges` field.
        badges: subjectBadgesMap.get(+rs.subjectId) ?? [],
      };

      if (userId) {
        const attemptedEasy = +raw.attemptedEasy || 0;
        const attemptedMedium = +raw.attemptedMedium || 0;
        const attemptedHard = +raw.attemptedHard || 0;
        const correctEasy = +raw.correctEasy || 0;
        const correctMedium = +raw.correctMedium || 0;
        const correctHard = +raw.correctHard || 0;
        Object.assign(card, {
          isSubscribed: raw.isSubscribed === 1 || raw.isSubscribed === '1',
          attempted, correct, wrong, skipped,
          accuracy, coverage, score,
          attemptedEasy, attemptedMedium, attemptedHard,
          correctEasy, correctMedium, correctHard,
          wrongEasy: +raw.wrongEasy || 0,
          wrongMedium: +raw.wrongMedium || 0,
          wrongHard: +raw.wrongHard || 0,
          userLevel: getAggregateUserLevel(
            attemptedEasy, correctEasy,
            attemptedMedium, correctMedium,
            attemptedHard, correctHard,
            correctCoverage,
          ),
          userRank: subjectMerits.userRanks.get(+rs.subjectId) ?? null,
        });
      }

      return card;
    });

    // ── Certification tracks view ──────────────────────────────────────────────
    type CertEntry = { meta: any; stIds: number[] };
    const certIndex = new Map<number, CertEntry>();
    for (const row of certRows) {
      if (!certIndex.has(+row.ctId)) {
        certIndex.set(+row.ctId, {
          meta: { id: +row.ctId, title: row.ctTitle, description: row.ctDesc, sortOrder: +row.ctSortOrder },
          stIds: [],
        });
      }
      certIndex.get(+row.ctId)!.stIds.push(+row.stId);
    }

    const certificationTracks = [...certIndex.values()]
      .sort((a, b) => a.meta.sortOrder - b.meta.sortOrder)
      .map(({ meta, stIds }) => {
        // Light subjectTrack cards for cert view (no full topic detail)
        const subjectTracks = [...new Set(stIds)].map((stId) => {
          const full = stMap.get(stId);
          if (!full) return null;
          const certRow = certRows.find((r) => +r.stId === stId);
          const light: any = {
            id: full.id, title: full.title, slug: full.slug, sortOrder: full.sortOrder,
            totalTopics: full.totalTopics,
            subject: { id: +certRow.stSubjectId, title: certRow.stSubjectTitle, slug: certRow.stSubjectSlug },
          };
          if (userId) {
            Object.assign(light, { progressPercent: full.progressPercent, isCompleted: full.isCompleted });
          }
          return light;
        }).filter(Boolean);

        const total = subjectTracks.length;
        const completed = userId ? subjectTracks.filter((st: any) => st.isCompleted).length : 0;
        const progressPercent = total > 0 ? +((completed / total) * 100).toFixed(0) : 0;
        const isAchieved = progressPercent >= CERT_ACHIEVED;

        const certCard: any = { ...meta, totalSubjectTracks: total, subjectTracks };
        if (userId) {
          Object.assign(certCard, {
            completedSubjectTracks: completed, progressPercent,
            isAchieved, achievementThreshold: CERT_ACHIEVED,
          });
        }
        return certCard;
      });

    const nextBestAction = userId
      ? this.pickNextBestAction(certificationTracks)
      : { nextCertificationTrack: null, nextSubjectTrack: null };

    return {
      jobRole: {
        id: jobRole.id, title: jobRole.title, slug: jobRole.slug,
        image: jobRole.image, color: jobRole.color, description: jobRole.description,
        body: (jobRole as any).body, scope: (jobRole as any).scope,
      },
      subjects,
      certificationTracks,
      meritList: jobRoleMerit.meritList,
      userRank: jobRoleMerit.userRank,
      ...nextBestAction,
      // Badges scoped to this job role, each tagged `unlocked` — empty array (not omitted) for
      // anonymous requests, matching the early-return path above.
      badges,
    };
  }
}
