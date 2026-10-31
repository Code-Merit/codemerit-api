import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CERT_ACHIEVED } from 'src/common/constants/completion-thresholds';
import { minCorrectForCertification } from 'src/common/utils/completion-rules';
import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { CertificateStatusEnum } from 'src/common/enum/certificate-status.enum';
import { EnrollmentStatusEnum } from 'src/common/enum/enrollment-status.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { SkillTypeEnum } from 'src/common/enum/skill-type.enum';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserStreak } from 'src/common/typeorm/entities/user-streak.entity';
import { computeAttemptMetrics, generateScore, getAggregateUserLevel } from 'src/common/utils/common-functions';
import { DataSource, Repository } from 'typeorm';
import { MeritService } from './merit.service';
import { SubjectStatsService } from './subject-stats.service';
import { TopicAnalysisService } from './topic-analysis.service';
import { SubjectTrackAnalysisService } from './subject-track-analysis.service';
import { DashboardLesson, LearningActivityService } from './learning-activity.service';
import { computeLevel } from '../../achievement/constants/gamification.constants';
import { MyGamificationStatsDto } from '../../achievement/dtos/my-gamification-stats.dto';
import { BadgeQueryService, ScopedBadgeDto } from '../../achievement/providers/badge-query.service';
import { SkillEnrollmentService } from '../../skill-enrollment/providers/skill-enrollment.service';

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
    private readonly skillEnrollmentService: SkillEnrollmentService,
    private readonly learningActivity: LearningActivityService,
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

    const incompleteTracks = (nextCt.subjectTracks ?? []).filter((st: any) => !st.isCompleted);

    // Prefer a track the learner has already started (real attempts, real score) over one
    // they haven't touched yet — otherwise an untouched track earlier in sortOrder always
    // wins even when they have real, attempted progress on a different track. progressPercent
    // alone can't distinguish "attempted but hasn't finished a topic yet" (0%) from "never
    // opened" (also 0%), so isStarted is checked directly. Within each group, still prefer
    // more progress first so partial topic completion counts for something.
    const byProgressDesc = (a: any, b: any) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0);
    const started = incompleteTracks.filter((st: any) => st.isStarted).sort(byProgressDesc);
    const nextSt = started[0] ?? [...incompleteTracks].sort(byProgressDesc)[0] ?? null;

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
            // Real performance data — already computed on nextSt by SubjectTrackAnalysisService,
            // just not forwarded before. Lets the "Next Assessment" widget show an actual score/
            // topics-covered readout instead of only a bare completion percent.
            score: nextSt.score ?? 0,
            accuracy: nextSt.currentAccuracy ?? 0,
            attempted: nextSt.attempted ?? 0,
            totalTopics: nextSt.totalTopics ?? 0,
            completedTopics: nextSt.completedTopics ?? 0,
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

  /** Career Dashboard job-role list: the union of explicitly *targeted* roles
   * (UserJobRole, shown even at 0% progress — a user should see the goal they
   * picked) and roles *derived* from real enrollment (>=1 active SkillEnrollment
   * among the role's subjects, via SkillEnrollmentService.getDerivedJobRoleIds) —
   * a user can be making real progress on a role's subjects without ever having
   * explicitly targeted it. `enrolledAt` is the UserJobRole targeting timestamp
   * where one exists, null for a derived-only role (it was never targeted). */
  private async fetchUserJobRoles(userId: number) {
    const targetedRows = await this.dataSource
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

    const derivedJobRoleIds = await this.skillEnrollmentService.getDerivedJobRoleIds(userId);
    const targetedIds = new Set(targetedRows.map((r) => +r.id));
    const derivedOnlyIds = derivedJobRoleIds.filter((id) => !targetedIds.has(id));

    if (!derivedOnlyIds.length) return targetedRows;

    const derivedOnlyRows = await this.dataSource
      .createQueryBuilder()
      .select('jr.id', 'id')
      .addSelect('jr.title', 'title')
      .addSelect('jr.slug', 'slug')
      .addSelect('jr.image', 'image')
      .addSelect('jr.color', 'color')
      .addSelect('jr.description', 'description')
      .addSelect('jr.scope', 'scope')
      .addSelect('jr.orderId', 'orderId')
      .addSelect('NULL', 'enrolledAt')
      .from(JobRole, 'jr')
      .where('jr.id IN (:...derivedOnlyIds)', { derivedOnlyIds })
      .andWhere('jr.isPublished = 1')
      .getRawMany();

    return [...targetedRows, ...derivedOnlyRows].sort((a, b) => a.orderId - b.orderId);
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
      .addSelect('ct.slug', 'ctSlug')
      .addSelect('ct.note', 'ctNote')
      .addSelect('COALESCE(ctjr.descriptionOverride, ct.description)', 'ctDesc')
      .addSelect('ctjr.sortOrder', 'ctSortOrder')
      .addSelect('ctjr.jobRoleId', 'ctJobRoleId')
      .addSelect('ct.subjectId', 'ctSubjectId')
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

  /**
   * Every certification that applies to the given job roles, in fetchCertTrackHierarchy's row
   * shape: the role's own linked tracks first, then each role subject's native tracks
   * (ct.subjectId set and published — the same rule the subject dashboard uses), attributed to
   * the role through job_role_subject. A native track the role also links comes back once, as
   * its linked row, so its per-role sortOrder/description override still win.
   */
  private async fetchRoleCertTrackHierarchy(jobRoleIds: number[]) {
    if (!jobRoleIds.length) return [];
    const [linked, native] = await Promise.all([
      this.fetchCertTrackHierarchy(jobRoleIds),
      this.dataSource
        .createQueryBuilder()
        .select('ct.id', 'ctId')
        .addSelect('ct.title', 'ctTitle')
        .addSelect('ct.slug', 'ctSlug')
        .addSelect('ct.note', 'ctNote')
        .addSelect('ct.description', 'ctDesc')
        .addSelect('jrs.jobRoleId', 'ctJobRoleId')
        .addSelect('ct.subjectId', 'ctSubjectId')
        .addSelect('st.id', 'stId')
        .addSelect('st.title', 'stTitle')
        .addSelect('st.slug', 'stSlug')
        .addSelect('st.sortOrder', 'stSortOrder')
        .addSelect('st.subjectId', 'stSubjectId')
        .addSelect('s.title', 'stSubjectTitle')
        .addSelect('s.slug', 'stSubjectSlug')
        .from('certification_track', 'ct')
        .innerJoin('job_role_subject', 'jrs', 'jrs.subjectId = ct.subjectId')
        .innerJoin('subject', 'rs', 'rs.id = jrs.subjectId AND rs.isPublished = 1')
        .innerJoin('certification_track_subject_track', 'ctst', 'ctst.certificationTrackId = ct.id')
        .innerJoin('subject_track', 'st', 'st.id = ctst.subjectTrackId AND st.isPublished = 1')
        .innerJoin('subject', 's', 's.id = st.subjectId')
        .where('jrs.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
        .andWhere('ct.isPublished = 1')
        .orderBy('jrs.jobRoleId', 'ASC')
        .addOrderBy('jrs.sortOrder', 'ASC')
        .addOrderBy('ct.id', 'ASC')
        .addOrderBy('st.sortOrder', 'ASC')
        .getRawMany(),
    ]);

    // Native tracks sort after the role's linked ones, in subject order then creation order.
    const linkedKeys = new Set(linked.map((r) => `${r.ctJobRoleId}:${r.ctId}`));
    const nativeOrder = new Map<string, number>();
    const nativeRows = native
      .filter((r) => !linkedKeys.has(`${r.ctJobRoleId}:${r.ctId}`))
      .map((r) => {
        const key = `${r.ctJobRoleId}:${r.ctId}`;
        if (!nativeOrder.has(key)) nativeOrder.set(key, 1000 + nativeOrder.size);
        return { ...r, ctSortOrder: nativeOrder.get(key) };
      });
    return [...linked, ...nativeRows];
  }

  // ─── Job Roles With Subjects (master data) ────────────────────────────────────

  async getJobRolesWithSubjects(userId?: number) {
    const qb = this.jobRoleRepo
      .createQueryBuilder('jobRole')
      .leftJoinAndSelect('jobRole.jobRoleSubjects', 'jrs')
      .leftJoinAndSelect('jrs.subject', 'subject')
      .leftJoinAndSelect('jobRole.group', 'jobRoleGroup')
      .select([
        'jobRole.id', 'jobRole.title', 'jobRole.slug', 'jobRole.description',
        'jobRole.image', 'jobRole.isPublished', 'jobRole.color',
        'jrs.id', 'jrs.tag', 'jrs.requiredLevel', 'subject.id', 'subject.title', 'subject.slug',
        'subject.image', 'subject.isPublished',
        'jobRoleGroup.id', 'jobRoleGroup.name', 'jobRoleGroup.slug',
      ])
      .where('jobRole.isPublished = :isPublished', { isPublished: 1 })
      .orderBy('jobRole.orderId', 'ASC');

    if (userId) {
      qb.addSelect(`CASE WHEN usr.id = :userId THEN 1 ELSE 0 END`, 'isSubscribed')
        .leftJoin(User, 'usr', 'usr.id = :userId', { userId });
    } else {
      qb.addSelect('FALSE', 'isSubscribed');
    }

    const [
      certCounts, stCounts, includedTrackCounts, questionCounts, topicTrackCounts,
      lessonCounts, enrollmentCounts, badgeCounts, xpPossibleCounts, { raw: rawRows, entities },
    ] = await Promise.all([
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
      this.fetchIncludedTrackCountsByJobRoleSubject(),
      this.fetchQuestionCountsByJobRole(),
      this.fetchTopicAndTrackCountsByJobRole(),
      this.fetchLessonCountsByJobRole(),
      this.fetchEnrollmentCountsByJobRole(),
      this.fetchBadgeCountsByJobRole(),
      this.fetchXpPossibleByJobRole(),
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
      group: jr.group ? { id: jr.group.id, name: jr.group.name, slug: jr.group.slug } : null,
      certificationTrackCount: certCounts.get(jr.id) ?? 0,
      // Card-level stats. Trivia/General/Topics/Tracks/Lessons are scoped to exactly the
      // SubjectTrack rows this role declares via job_role_subject_track (see
      // fetchQuestionCountsByJobRole/fetchTopicAndTrackCountsByJobRole/fetchLessonCountsByJobRole)
      // — NOT the whole subject — so two roles sharing a subject at different depths (e.g.
      // Frontend Engineer Trainee's Intermediate JS vs Frontend Engineer's Advanced JS) show
      // genuinely different numbers instead of an identical subject-wide total. A role with no
      // JobRoleSubjectTrack rows for a subject yet (e.g. the unpublished React placeholder)
      // correctly shows 0 rather than a misleading whole-subject count.
      numTopics: topicTrackCounts.get(jr.id)?.topicCount ?? 0,
      numSubjectTracks: topicTrackCounts.get(jr.id)?.trackCount ?? 0,
      numTrivia: questionCounts.get(jr.id)?.numTrivia ?? 0,
      numGeneral: questionCounts.get(jr.id)?.numGeneral ?? 0,
      numLessons: lessonCounts.get(jr.id) ?? 0,
      numBadges: badgeCounts.get(jr.id) ?? 0,
      // Sum of Question.marks across every Active question in scope (Trivia + General) — "how
      // much XP a learner could earn by correctly answering everything available today." Not
      // real awarded XP (see AchievementService.awardXpAndLevel — XP is per-submission, dedup'd
      // per question, plus completion/perfect-score bonuses with no natural "total" definition);
      // this is a simpler, well-defined proxy the product asked for: marks, not XP history.
      xpPossible: xpPossibleCounts.get(jr.id) ?? 0,
      // Distinct users with any/an Active SkillEnrollment in one of this role's subjects — the
      // real enrollment signal in this app (never isSubscribed/UserJobRole, see
      // SkillEnrollmentService). currentEnrollments <= totalEnrollments always.
      currentEnrollments: enrollmentCounts.get(jr.id)?.current ?? 0,
      totalEnrollments: enrollmentCounts.get(jr.id)?.total ?? 0,
      // Unpublished subjects (admin drafts, retired tech) never reach the catalog card.
      subjects: jr.jobRoleSubjects
        .filter((jrs) => jrs.subject?.isPublished)
        .map((jrs) => ({
          id: jrs.subject.id,
          title: jrs.subject.title,
          slug: jrs.subject.slug,
          image: jrs.subject.image,
          tag: jrs.tag,
          requiredLevel: jrs.requiredLevel,
          // Total tracks the SUBJECT has vs. how many of them THIS role actually declares —
          // e.g. Angular Developer 2/5, Angular Architect 5/5 — the per-subject transparency
          // signal backing the job-role-level numSubjectTracks/numTopics rollups above.
          subjectTrackCount: stCounts.get(jrs.subject.id) ?? 0,
          includedTrackCount: includedTrackCounts.get(jrs.id) ?? 0,
        })),
    }));
  }

  /** How many SubjectTracks each JobRoleSubject pairing actually declares (via
   * job_role_subject_track) — the per-subject-chip counterpart to fetchTopicAndTrackCountsByJobRole's
   * job-role-level rollup. Keyed by job_role_subject.id, not jobRoleId. */
  private async fetchIncludedTrackCountsByJobRoleSubject(): Promise<Map<number, number>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('jrst.jobRoleSubjectId', 'jrsId')
      .addSelect('COUNT(DISTINCT jrst.subjectTrackId)', 'count')
      .from('job_role_subject_track', 'jrst')
      .groupBy('jrst.jobRoleSubjectId')
      .getRawMany();
    return new Map(rows.map((r) => [+r.jrsId, +r.count]));
  }

  /** Distinct SubjectTracks/Topics reachable from a job role's declared scope
   * (job_role_subject -> job_role_subject_track -> subject_track_topic) — backs the "N Topics"
   * / "N Subject Tracks" stats on the job-role catalog card. */
  private async fetchTopicAndTrackCountsByJobRole(): Promise<Map<number, { topicCount: number; trackCount: number }>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('jrs.jobRoleId', 'jobRoleId')
      .addSelect('COUNT(DISTINCT jrst.subjectTrackId)', 'trackCount')
      .addSelect('COUNT(DISTINCT stt.topicId)', 'topicCount')
      .from('job_role_subject', 'jrs')
      .innerJoin('job_role_subject_track', 'jrst', 'jrst.jobRoleSubjectId = jrs.id')
      .innerJoin('subject_track_topic', 'stt', 'stt.subjectTrackId = jrst.subjectTrackId')
      .groupBy('jrs.jobRoleId')
      .getRawMany();
    return new Map(rows.map((r) => [+r.jobRoleId, { topicCount: +r.topicCount, trackCount: +r.trackCount }]));
  }

  /** Active Trivia and General question counts, scoped to exactly the topics reachable from a
   * job role's declared SubjectTrack scope (see fetchTopicAndTrackCountsByJobRole) — replaces
   * the old whole-subject count so roles sharing a subject at different depths show genuinely
   * different numbers. Backs the "N Trivia" / "N General" stats on the job-role catalog card. */
  private async fetchQuestionCountsByJobRole(): Promise<Map<number, { numTrivia: number; numGeneral: number }>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('jrs.jobRoleId', 'jobRoleId')
      .addSelect(`COUNT(DISTINCT CASE WHEN q.questionType = :trivia THEN q.id END)`, 'numTrivia')
      .addSelect(`COUNT(DISTINCT CASE WHEN q.questionType = :general THEN q.id END)`, 'numGeneral')
      .from('job_role_subject', 'jrs')
      .innerJoin('job_role_subject_track', 'jrst', 'jrst.jobRoleSubjectId = jrs.id')
      .innerJoin('subject_track_topic', 'stt', 'stt.subjectTrackId = jrst.subjectTrackId')
      .innerJoin('question_topic', 'qt', 'qt.topicId = stt.topicId')
      .innerJoin('question', 'q', 'q.id = qt.questionId AND q.status = :active')
      .setParameters({
        trivia: QuestionTypeEnum.Trivia,
        general: QuestionTypeEnum.General,
        active: QuestionStatusEnum.Active,
      })
      .groupBy('jrs.jobRoleId')
      .getRawMany();
    return new Map(rows.map((r) => [+r.jobRoleId, { numTrivia: +r.numTrivia, numGeneral: +r.numGeneral }]));
  }

  /** Sum of Question.marks across every distinct Active question (Trivia + General) reachable
   * from a job role's declared SubjectTrack scope — "how much XP could be earned by correctly
   * answering everything available." A subquery with DISTINCT(jobRoleId, questionId) avoids
   * double-counting a question reachable via more than one topic in scope, the same
   * over-count risk fetchQuestionCountsByJobRole avoids with COUNT(DISTINCT ...). */
  private async fetchXpPossibleByJobRole(): Promise<Map<number, number>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('x.jobRoleId', 'jobRoleId')
      .addSelect('SUM(x.marks)', 'xpPossible')
      .from((qb) => qb
        .select('jrs.jobRoleId', 'jobRoleId')
        .addSelect('q.id', 'questionId')
        .addSelect('q.marks', 'marks')
        .distinct(true)
        .from('job_role_subject', 'jrs')
        .innerJoin('job_role_subject_track', 'jrst', 'jrst.jobRoleSubjectId = jrs.id')
        .innerJoin('subject_track_topic', 'stt', 'stt.subjectTrackId = jrst.subjectTrackId')
        .innerJoin('question_topic', 'qt', 'qt.topicId = stt.topicId')
        .innerJoin('question', 'q', 'q.id = qt.questionId AND q.status = :active'), 'x')
      .setParameter('active', QuestionStatusEnum.Active)
      .groupBy('x.jobRoleId')
      .getRawMany();
    return new Map(rows.map((r) => [+r.jobRoleId, +r.xpPossible]));
  }

  /** Lessons reachable from a job role's declared SubjectTrack scope (Lesson.topicId falling
   * inside one of those tracks) — backs the "N Lessons" stat on the job-role catalog card. */
  private async fetchLessonCountsByJobRole(): Promise<Map<number, number>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('jrs.jobRoleId', 'jobRoleId')
      .addSelect('COUNT(DISTINCT l.id)', 'count')
      .from('job_role_subject', 'jrs')
      .innerJoin('job_role_subject_track', 'jrst', 'jrst.jobRoleSubjectId = jrs.id')
      .innerJoin('subject_track_topic', 'stt', 'stt.subjectTrackId = jrst.subjectTrackId')
      .innerJoin('lesson', 'l', 'l.topicId = stt.topicId')
      .groupBy('jrs.jobRoleId')
      .getRawMany();
    return new Map(rows.map((r) => [+r.jobRoleId, +r.count]));
  }

  /** Distinct users enrolled (SkillEnrollment) in any of a job role's subjects — current
   * (status=Active right now) vs total (any status, ever) — backs the "Enrollments" stat on
   * the job-role catalog card. Subject-scoped, not track-scoped: enrollment is a subject-level
   * concept in this app (see SkillEnrollment entity), unlike the content stats above. */
  private async fetchEnrollmentCountsByJobRole(): Promise<Map<number, { current: number; total: number }>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('jrs.jobRoleId', 'jobRoleId')
      .addSelect('COUNT(DISTINCT se.userId)', 'total')
      .addSelect(`COUNT(DISTINCT CASE WHEN se.status = :active THEN se.userId END)`, 'current')
      .from('job_role_subject', 'jrs')
      .innerJoin('skill_enrollment', 'se', 'se.subjectId = jrs.subjectId')
      .setParameters({ active: EnrollmentStatusEnum.Active })
      .groupBy('jrs.jobRoleId')
      .getRawMany();
    return new Map(rows.map((r) => [+r.jobRoleId, { current: +r.current, total: +r.total }]));
  }

  /** Published badges earnable toward each job role: badges scoped directly to the JobRole
   * (BadgeScopeEnum.JOBROLE) plus every SUBJECT-scoped badge belonging to one of that role's
   * subjects, summed — backs the "N Badges" stat on the job-role catalog card. Two grouped
   * queries, not one per role. */
  private async fetchBadgeCountsByJobRole(): Promise<Map<number, number>> {
    const [roleScoped, subjectScoped] = await Promise.all([
      this.dataSource
        .createQueryBuilder()
        .select('b.scopeId', 'jobRoleId')
        .addSelect('COUNT(b.id)', 'count')
        .from('badge', 'b')
        .where('b.scopeType = :scopeType AND b.isPublished = :pub', {
          scopeType: BadgeScopeEnum.JOBROLE,
          pub: 1,
        })
        .groupBy('b.scopeId')
        .getRawMany(),
      this.dataSource
        .createQueryBuilder()
        .select('jrs.jobRoleId', 'jobRoleId')
        .addSelect('COUNT(b.id)', 'count')
        .from('job_role_subject', 'jrs')
        .innerJoin(
          'badge', 'b',
          'b.scopeId = jrs.subjectId AND b.scopeType = :scopeType AND b.isPublished = :pub',
          { scopeType: BadgeScopeEnum.SUBJECT, pub: 1 },
        )
        .groupBy('jrs.jobRoleId')
        .getRawMany(),
    ]);
    const map = new Map<number, number>();
    for (const r of roleScoped) map.set(+r.jobRoleId, (map.get(+r.jobRoleId) ?? 0) + +r.count);
    for (const r of subjectScoped) map.set(+r.jobRoleId, (map.get(+r.jobRoleId) ?? 0) + +r.count);
    return map;
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
      this.fetchRoleCertTrackHierarchy(jobRoleIds),
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
          meta: { id: +row.ctId, title: row.ctTitle, slug: row.ctSlug, note: row.ctNote, description: row.ctDesc, sortOrder: +row.ctSortOrder, subjectId: row.ctSubjectId != null ? +row.ctSubjectId : null },
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
        // Weighted by actual question volume, not completed/total subject tracks — see the
        // identical fix (and its full rationale) in certificate.service.ts's toDto() and
        // subject-stats.service.ts's getCertificationTracksForSubject. The old formula here
        // floored at 0% until an entire subject track finished, even with real attempts logged.
        const totalQuestions = subjectTracks.reduce((sum: number, st: any) => sum + (st.numTrivia || 0), 0);
        const questionsAttempted = subjectTracks.reduce((sum: number, st: any) => sum + (st.attempted || 0), 0);
        const progressPercent = totalQuestions > 0 && questionsAttempted > 0
          ? Math.max(1, Math.round((questionsAttempted / totalQuestions) * 100))
          : 0;
        const isAchieved = progressPercent >= CERT_ACHIEVED;

        totalCerts++;
        if (isAchieved) certsAchieved++;
        else if (completed > 0) certsInProgress++;

        return {
          ...ct,
          totalSubjectTracks: total, completedSubjectTracks: completed,
          progressPercent, isAchieved, achievementThreshold: CERT_ACHIEVED,
          correctAnswersToEarn: minCorrectForCertification(
            subjectTracks.map((st: any) => st.minCorrectToComplete), CERT_ACHIEVED,
          ),
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
    return { roles: [], role: null, gamification: null, accountBadges: null };
  }

  /** The learning dashboard's one call: the user's roles as a short list, full detail for the
   * selected role only, account-wide XP/level/streak, and — for a user with no role yet — their
   * account-wide badges. `jobRoleSlug` is honoured only when it is one of the user's own roles;
   * otherwise the default role is used. */
  async getEnrichedCareerDashboard(userId: number, jobRoleSlug?: string) {
    try {
      return await this.buildEnrichedCareerDashboard(userId, jobRoleSlug);
    } catch (err) {
      console.error('[getEnrichedCareerDashboard] Unexpected error for userId', userId, err?.message ?? err);
      return this.emptyEnrichedDashboard();
    }
  }

  // The requested role if it's one of the user's, else the most recently targeted role, else the
  // first derived one (fetchUserJobRoles' order).
  private pickDashboardRole(jobRoles: any[], jobRoleSlug?: string) {
    const requested = jobRoleSlug ? jobRoles.find((jr) => jr.slug === jobRoleSlug) : null;
    if (requested) return requested;
    const targeted = jobRoles.filter((jr) => jr.enrolledAt);
    if (!targeted.length) return jobRoles[0];
    return targeted.reduce((latest, jr) => (new Date(jr.enrolledAt) > new Date(latest.enrolledAt) ? jr : latest));
  }

  /** Account-wide XP, level and streak — the same shape as AchievementService.getMyGamificationStats
   * without a subjectId. Read here because AchievementModule imports MasterModule, not the reverse. */
  private async fetchGamificationStats(userId: number): Promise<MyGamificationStatsDto> {
    const [user, streak] = await Promise.all([
      this.dataSource.getRepository(User).findOne({ where: { id: userId }, select: ['id', 'points'] }),
      this.dataSource.getRepository(UserStreak).findOne({ where: { userId } }),
    ]);
    const totalPoints = user?.points ?? 0;
    return {
      totalPoints,
      level: computeLevel(totalPoints),
      streak: streak ? { current: streak.currentStreak, longest: streak.longestStreak } : null,
      subjectXp: null,
    };
  }

  // Subjects the user has rated themselves on — the same rule the skill-rating wizard uses.
  private async fetchSelfRatedSubjectIds(userId: number, subjectIds: number[]): Promise<Set<number>> {
    if (!subjectIds.length) return new Set();
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('DISTINCT sr.skillId', 'subjectId')
      .from('skill_rating', 'sr')
      .innerJoin('assessment_session', 'ases', 'ases.id = sr.assessmentSessionId')
      .where('ases.userId = :userId', { userId })
      .andWhere('sr.skillType = :subject', { subject: SkillTypeEnum.SUBJECT })
      .andWhere('sr.skillId IN (:...subjectIds)', { subjectIds })
      .getRawMany();
    return new Set(rows.map((r) => +r.subjectId));
  }

  private async buildEnrichedCareerDashboard(userId: number, jobRoleSlug?: string) {
    const [jobRoles, gamification] = await Promise.all([
      this.fetchUserJobRoles(userId),
      this.fetchGamificationStats(userId),
    ]);

    const roles = jobRoles.map((jr) => ({ id: +jr.id, title: jr.title, slug: jr.slug, image: jr.image ?? null }));
    if (!jobRoles.length) {
      const accountBadges = await this.badgeQueryService
        .getUserBadges(userId)
        .catch(() => ({ earned: [], locked: [] }));
      return { roles, role: null, gamification, accountBadges };
    }

    // Full detail is computed for the selected role only; switching roles is a new request.
    const selectedRole = this.pickDashboardRole(jobRoles, jobRoleSlug);
    const jobRoleIds = [+selectedRole.id];
    const roleSubjectRows = await this.fetchRoleSubjects(jobRoleIds);
    const allSubjectIds = [...new Set(roleSubjectRows.map((rs) => +rs.subjectId))];

    const [
      subjectStatsMap, certRows, lessons, badgesByRole, badgesBySubject, selfRatedSubjectIds, learnerCountsByRole,
      jobRoleMastery, allowances, activity, questBonusClaimed, interviewOfTheDay,
    ] = await Promise.all([
      this.subjectStats.getSubjectStatsMap(userId, allSubjectIds),
      this.fetchRoleCertTrackHierarchy(jobRoleIds),
      this.learningActivity.getLessonsWithProgress(userId, allSubjectIds),
      Promise.all(
        jobRoleIds.map((jrId) =>
          this.badgeQueryService
            .getUserBadgesForScope(BadgeScopeEnum.JOBROLE, jrId, userId)
            .then((badges): [number, ScopedBadgeDto[]] => [jrId, badges ?? []])
            .catch((): [number, ScopedBadgeDto[]] => [jrId, []]),
        ),
      ).then((entries) => new Map(entries)),
      // A role's badges are almost all its subjects' badges, not JobRole-scoped ones.
      this.badgeQueryService
        .getUserBadgesGroupedBySubject(allSubjectIds, userId)
        .catch(() => new Map<number, ScopedBadgeDto[]>()),
      this.fetchSelfRatedSubjectIds(userId, allSubjectIds),
      this.fetchJobRoleLearnerCounts(jobRoleIds),
      this.meritService.getJobRoleMasteryLeaderboards(jobRoleIds, userId),
      this.skillEnrollmentService.getDailyQuestionAllowances(userId, allSubjectIds),
      this.learningActivity.getDailyActivity(userId),
      this.learningActivity.isQuestBonusClaimed(userId),
      this.learningActivity.getInterviewOfTheDay(userId, allSubjectIds),
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
          meta: {
            id: +row.ctId, title: row.ctTitle, slug: row.ctSlug, note: row.ctNote, description: row.ctDesc,
            sortOrder: +row.ctSortOrder, subjectId: row.ctSubjectId != null ? +row.ctSubjectId : null,
          },
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

    const buildRoleDashboard = (jr: any) => {
      const subjects = subjectsByJobRole.get(+jr.id) ?? [];

      // Job-role level trivia metrics (weighted totals, not average of averages) — pooled
      // over every enrolled subject in the role, mandatory-tagged or not, so Score shares
      // the exact same population as Accuracy/Coverage/Lessons/userLevel below instead of a
      // MANDATORY-only subset (a prior version scoped Score to MANDATORY subjects while
      // leaving these others unfiltered, so the two could silently describe different
      // subjects — fixed by pooling all of them from the same totals).
      const jrTotalAttempted = subjects.reduce((s: number, sub: any) => s + sub.attempted, 0);
      const jrTotalCorrect = subjects.reduce((s: number, sub: any) => s + sub.correct, 0);
      const jrTotalWrong = subjects.reduce((s: number, sub: any) => s + sub.wrong, 0);
      const jrTotalNumTrivia = subjects.reduce((s: number, sub: any) => s + sub.numTrivia, 0);
      const jrAccuracy = jrTotalAttempted > 0 ? +(jrTotalCorrect * 100 / jrTotalAttempted).toFixed(1) : 0;
      const jrTriviaCompletion = jrTotalNumTrivia > 0 ? +((jrTotalAttempted / jrTotalNumTrivia) * 100).toFixed(1) : 0;
      const jrScore = +generateScore(jrTotalAttempted, jrTotalCorrect, jrTotalWrong).toFixed(0);

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
        // Weighted by actual question volume, not completed/total subject tracks — see the
        // identical fix (and its full rationale) in certificate.service.ts's toDto(). Pulled
        // from the full stMap entries (numTrivia/attempted), not the light `subjectTracks`
        // above, which deliberately drops those fields to keep this dashboard shape lean.
        const uniqueStIds = [...new Set(stIds)];
        const totalQuestions = uniqueStIds.reduce((sum: number, stId: number) => sum + (stMap.get(stId)?.numTrivia || 0), 0);
        const questionsAttempted = uniqueStIds.reduce((sum: number, stId: number) => sum + (stMap.get(stId)?.attempted || 0), 0);
        const progressPercent = totalQuestions > 0 && questionsAttempted > 0
          ? Math.max(1, Math.round((questionsAttempted / totalQuestions) * 100))
          : 0;
        const isAchieved = progressPercent >= CERT_ACHIEVED;

        if (isAchieved) jrCertsAchieved++;
        else if (completed > 0) jrCertsInProgress++;

        return {
          ...ct,
          totalSubjectTracks: total, completedSubjectTracks: completed,
          progressPercent, isAchieved, achievementThreshold: CERT_ACHIEVED,
          correctAnswersToEarn: minCorrectForCertification(
            uniqueStIds.filter((id) => stMap.has(id)).map((id) => stMap.get(id).minCorrectToComplete),
            CERT_ACHIEVED,
          ),
          subjectTracks,
          // Formal issuance record, distinct from isAchieved above (progress can hit 100%
          // before a Certificate row is actually created) — null until one exists. Named
          // myCertificate like every other CertificationTrack shape the frontend reads.
          myCertificate: certificatesByTrack.get(+ct.id) ?? null,
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

      // The role's own badges, then each subject's in the role's subject order.
      const roleBadges = [
        ...(badgesByRole.get(+jr.id) ?? []),
        ...[...subjects]
          .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
          .flatMap((s: any) => badgesBySubject.get(s.id) ?? []),
      ];
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
          lessonsTotal: s.lessonTotal, lessonsCompleted: s.lessonCompleted, numTrivia: s.numTrivia,
          // Today's practice allowance: hasAccess false = premium subject not enrolled;
          // dailyQuestionCap null = unlimited.
          practice: {
            hasAccess: allowances.get(s.id)?.tier != null,
            dailyQuestionCap: allowances.get(s.id)?.dailyQuestionCap ?? null,
            questionsUsedToday: allowances.get(s.id)?.questionsUsedToday ?? 0,
          },
        }));

      const subjectById = new Map(subjectsOut.map((s) => [s.id, s]));
      const withSubject = (l: DashboardLesson) => ({
        ...l, subjectTitle: subjectById.get(l.subjectId)?.title ?? '', subjectImage: subjectById.get(l.subjectId)?.image ?? null,
      });
      const pickedLessons = this.learningActivity.pickDashboardLessons(lessons, subjectsOut.map((s) => s.id));

      return {
        id: +jr.id, title: jr.title, slug: jr.slug,
        image: jr.image, color: jr.color, description: jr.description,
        scope: jr.scope ?? null,
        enrolledAt: jr.enrolledAt ?? null,
        summary: {
          // Readiness = coverage only: the share of the role's practice questions answered
          // correctly. Starts at 0 and grows only by covering more of the role.
          readiness: Math.round(jrCorrectCoverage),
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
          // Rank on the role's mastery board (null until the learner has a correct answer there),
          // and how many learners are pursuing the role — the ID card's "Top X%".
          peerRank,
          totalLearners: learnerCountsByRole.get(+jr.id) ?? 0,
        },
        subjects: subjectsOut,
        certificationTracks,
        badges: roleBadges,
        selfRatingDone: subjects.some((s: any) => selfRatedSubjectIds.has(s.id)),
        // Opened-but-unfinished lessons (most recent first); for a learner with none, where to start.
        lessons: {
          inProgress: pickedLessons.inProgress.map(withSubject),
          recommended: pickedLessons.recommended.map(withSubject),
        },
        // Role mastery board (distinct correct questions in the role's subjects): the user's rank
        // and whoever sits directly above and below.
        leaderboard: {
          rank: peerRank,
          around: (jobRoleMastery.around.get(+jr.id) ?? []).map((m: any) => ({
            rank: m.rank, name: m.name, username: m.username, image: m.image,
            masteryCount: m.masteryCount, isYou: m.userId === userId,
          })),
        },
        interviewOfTheDay,
        nextCertificationTrack,
        nextSubjectTrack,
        strongestSubject: strongestSubject
          ? {
              id: strongestSubject.id, title: strongestSubject.title, slug: strongestSubject.slug,
              image: strongestSubject.image, score: strongestSubject.score, accuracy: strongestSubject.accuracy,
            }
          : null,
      };
    };

    return {
      roles,
      role: buildRoleDashboard(selectedRole),
      gamification,
      accountBadges: null,
      // Account-wide: one row per day (oldest first), and today's quests from today's row.
      activity,
      today: this.learningActivity.buildTodayQuests(activity[activity.length - 1], questBonusClaimed),
    };
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
      this.fetchRoleCertTrackHierarchy([jobRoleId]),
      this.subjectStats.getSubjectStatsMap(userId, subjectIds),
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
    // Issued certificates (a visitor has none) — distinct from isAchieved, which is only progress.
    const certificatesByTrack = userId
      ? await this.fetchCertificatesForTracks(userId, [...new Set(certRows.map((r) => +r.ctId))])
      : new Map<number, any>();

    type CertEntry = { meta: any; stIds: number[] };
    const certIndex = new Map<number, CertEntry>();
    for (const row of certRows) {
      if (!certIndex.has(+row.ctId)) {
        certIndex.set(+row.ctId, {
          meta: { id: +row.ctId, title: row.ctTitle, slug: row.ctSlug, note: row.ctNote, description: row.ctDesc, sortOrder: +row.ctSortOrder, subjectId: row.ctSubjectId != null ? +row.ctSubjectId : null },
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
        // Weighted by actual question volume, not completed/total subject tracks — see the
        // identical fix (and its full rationale) in certificate.service.ts's toDto(). Pulled
        // from the full stMap entries (numTrivia/attempted), not the light `subjectTracks`
        // above, which deliberately drops those fields to keep this card shape lean.
        const uniqueStIds = [...new Set(stIds)];
        const totalQuestions = uniqueStIds.reduce((sum: number, stId: number) => sum + (stMap.get(stId)?.numTrivia || 0), 0);
        const questionsAttempted = userId
          ? uniqueStIds.reduce((sum: number, stId: number) => sum + (stMap.get(stId)?.attempted || 0), 0)
          : 0;
        const progressPercent = totalQuestions > 0 && questionsAttempted > 0
          ? Math.max(1, Math.round((questionsAttempted / totalQuestions) * 100))
          : 0;
        const isAchieved = progressPercent >= CERT_ACHIEVED;

        // Progress fields are always present (zero for a visitor), so the card is the complete
        // CertificationTrack shape the shared certificate components expect.
        return {
          ...meta, totalSubjectTracks: total, subjectTracks,
          correctAnswersToEarn: minCorrectForCertification(
            uniqueStIds.filter((id) => stMap.has(id)).map((id) => stMap.get(id).minCorrectToComplete),
            CERT_ACHIEVED,
          ),
          completedSubjectTracks: completed, progressPercent,
          isAchieved, achievementThreshold: CERT_ACHIEVED,
          myCertificate: certificatesByTrack.get(+meta.id) ?? null,
        };
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
