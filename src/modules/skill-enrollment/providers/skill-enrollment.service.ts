import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { SkillEnrollment } from 'src/common/typeorm/entities/skill-enrollment.entity';
import { SkillTierOffering } from 'src/common/typeorm/entities/skill-tier-offering.entity';
import { EnrollmentTierCapConfig } from 'src/common/typeorm/entities/enrollment-tier-cap-config.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { EnrollmentBatch } from 'src/common/typeorm/entities/enrollment-batch.entity';
import { EnrollmentStatusEnum } from 'src/common/enum/enrollment-status.enum';
import { EnrollmentSourceEnum } from 'src/common/enum/enrollment-source.enum';
import { EnrollmentBatchStatusEnum } from 'src/common/enum/enrollment-batch-status.enum';
import { EnrollmentTierEnum, TIER_RANK } from 'src/common/enum/enrollment-tier.enum';
import { SubjectTagEnum } from 'src/common/enum/subject-tag.enum';
import { GrantEnrollmentDto } from '../dtos/grant-enrollment.dto';
import { UpsertTierOfferingDto } from '../dtos/upsert-tier-offering.dto';
import { BatchUpsertTierOfferingsDto } from '../dtos/batch-upsert-tier-offerings.dto';
import { BatchDeactivateTierOfferingsDto } from '../dtos/batch-deactivate-tier-offerings.dto';
import {
  DEFAULT_TIER_CAPS,
  DEFAULT_TIER_DURATION_MONTHS,
} from '../constants/skill-enrollment.constants';

export type EnrollmentSkipReason = 'subject_not_found' | 'already_enrolled' | 'tier_not_offered';

export interface EnrollmentSkip {
  subjectId: number;
  reason: EnrollmentSkipReason;
}

export interface EnrollmentBatchResult {
  batch: EnrollmentBatch | null;
  enrolled: SkillEnrollment[];
  skipped: EnrollmentSkip[];
}

export type TierOfferingBatchSkipReason =
  | 'subject_not_found'
  | 'basic_not_offerable'
  | 'offering_not_found'
  | 'already_inactive';

export interface TierOfferingBatchSkip {
  subjectId: number;
  tier: EnrollmentTierEnum;
  reason: TierOfferingBatchSkipReason;
}

// Shape returned by listMine()/listAll() — every SkillEnrollment column plus the two
// fields attachSubjectNames() derives. Named here (rather than left as `any[]`) so
// consumers like getMyEnrollmentSummary() below can filter/reuse it with real typing.
export interface SubjectEnrollmentSummary extends SkillEnrollment {
  subjectName: string | null;
  isCurrentlyActive: boolean;
}

// Shape returned by getJobRoleSubjectsBreakdown() — named so getMyEnrollmentSummary()
// can reuse it directly and a job-role entry in the login response has the exact same
// shape as GET /apis/enrollments/job-role/:id/subjects.
export interface JobRoleSubjectsBreakdown {
  jobRoleId: number;
  jobRoleTitle: string;
  subjects: {
    subjectId: number;
    title: string;
    tier: EnrollmentTierEnum | null;
    isPremium: boolean;
    tag: SubjectTagEnum;
  }[];
}

@Injectable()
export class SkillEnrollmentService {
  constructor(
    @InjectRepository(SkillEnrollment)
    private readonly enrollmentRepo: Repository<SkillEnrollment>,
    @InjectRepository(SkillTierOffering)
    private readonly tierOfferingRepo: Repository<SkillTierOffering>,
    @InjectRepository(EnrollmentTierCapConfig)
    private readonly tierCapConfigRepo: Repository<EnrollmentTierCapConfig>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(JobRole)
    private readonly jobRoleRepo: Repository<JobRole>,
    @InjectRepository(JobRoleSubject)
    private readonly jobRoleSubjectRepo: Repository<JobRoleSubject>,
    @InjectRepository(EnrollmentBatch)
    private readonly batchRepo: Repository<EnrollmentBatch>,
  ) {}

  // ---------------------------------------------------------------------------
  // Enrollment grant/purchase — always subject-scoped
  // ---------------------------------------------------------------------------

  /** Manual admin grant — the self-service counterpart is fulfillPurchase() below,
   * called by PaymentService once a webhook confirms a real payment. */
  async grantEnrollment(
    dto: GrantEnrollmentDto,
    grantedBy: number,
  ): Promise<SkillEnrollment> {
    return this.createEnrollment({
      userId: dto.userId,
      subjectId: dto.subjectId,
      tier: dto.tier,
      months: dto.months,
      source: EnrollmentSourceEnum.AdminGrant,
      price: dto.price ?? null,
      currency: dto.currency ?? null,
      reference: dto.reference ?? null,
      grantedBy,
      note: dto.note ?? null,
    });
  }

  /** Self-serve, free, no admin/payment involved — the explicit "enroll in Basic"
   * action for a single subject. Thin wrapper over enrollBasicBatch([subjectId]) so
   * there's one real implementation of "create a free enrollment," not two —
   * preserves the exact same error contract as before (404 unknown subject, 409
   * already enrolled) even though the batch method itself never throws on a
   * per-subject conflict (see enrollBasicBatch's skip-and-proceed doc). */
  async enrollBasic(userId: number, subjectId: number): Promise<SkillEnrollment> {
    const result = await this.enrollBasicBatch(userId, [subjectId]);
    if (result.enrolled.length) {
      return result.enrolled[0];
    }
    const reason = result.skipped[0]?.reason;
    if (reason === 'subject_not_found') {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Subject ${subjectId} not found.`);
    }
    throw new AppCustomException(
      HttpStatus.CONFLICT,
      `This user already has an active enrollment for this subject. Revoke it first to change tiers.`,
    );
  }

  /** Enroll in the free Basic tier for several subjects at once — "enroll me in this
   * job role's subjects, all of them or the ones I picked" for the free path. Every
   * eligible subject gets its own SkillEnrollment row (never expires, no offering
   * needed — Basic is universal), all tagged with one new EnrollmentBatch for
   * provenance/grouping. Skip-and-proceed: a subject that doesn't exist, or where the
   * user already holds any active enrollment, is dropped from the batch rather than
   * failing the whole request — see partitionSubjectsForEnrollment. Returns `batch:
   * null` (no header row created) if every requested subject ended up skipped, so an
   * all-conflict request doesn't leave behind an empty, pointless batch. `jobRoleId`
   * is optional, opaque provenance only — never validated against JobRoleSubject. */
  async enrollBasicBatch(
    userId: number,
    subjectIds: number[],
    jobRoleId?: number,
  ): Promise<EnrollmentBatchResult> {
    const uniqueIds = Array.from(new Set(subjectIds));
    const { eligible, skipped } = await this.partitionSubjectsForEnrollment(userId, uniqueIds);

    if (!eligible.length) {
      return { batch: null, enrolled: [], skipped };
    }

    const batch = await this.batchRepo.save(
      this.batchRepo.create({
        userId,
        jobRoleId: jobRoleId ?? null,
        tier: EnrollmentTierEnum.Basic,
        status: EnrollmentBatchStatusEnum.Completed,
        source: EnrollmentSourceEnum.Promo,
        totalAmount: null,
        currency: null,
        completedAt: new Date(),
      }),
    );

    // Each subject gets its own (userId, subjectId) lock inside createEnrollment, so
    // these are independent and safe to run concurrently rather than one-by-one.
    const enrolled = await Promise.all(
      eligible.map((subjectId) =>
        this.createEnrollment({
          userId,
          subjectId,
          tier: EnrollmentTierEnum.Basic,
          source: EnrollmentSourceEnum.Promo,
          price: null,
          currency: null,
          reference: null,
          grantedBy: null,
          note: null,
          batchId: batch.id,
        }),
      ),
    );

    return { batch, enrolled, skipped };
  }

  /** Bulk-friendly (two queries, not N+1) split of a requested subject list into
   * what's actually enrollable right now for this user vs. what has to be skipped and
   * why — shared by the free batch path above and PaymentService's paid batch
   * checkout, which additionally filters on tier-offering availability on top of
   * this. Reasons: 'subject_not_found' (bad id) or 'already_enrolled' (any active
   * enrollment already exists for that subject, any tier). */
  async partitionSubjectsForEnrollment(
    userId: number,
    subjectIds: number[],
  ): Promise<{ eligible: number[]; skipped: EnrollmentSkip[] }> {
    if (!subjectIds.length) return { eligible: [], skipped: [] };

    const subjects = await this.subjectRepo.find({
      where: { id: In(subjectIds) },
      select: ['id'],
    });
    const existingIds = new Set(subjects.map((s) => s.id));

    const now = new Date();
    const activeEnrollments = await this.enrollmentRepo
      .createQueryBuilder('e')
      .where('e.userId = :userId', { userId })
      .andWhere('e.subjectId IN (:...subjectIds)', { subjectIds })
      .andWhere('e.status = :status', { status: EnrollmentStatusEnum.Active })
      .andWhere('(e.expiresAt IS NULL OR e.expiresAt > :now)', { now })
      .getMany();
    const activeSubjectIds = new Set(activeEnrollments.map((e) => e.subjectId));

    const eligible: number[] = [];
    const skipped: EnrollmentSkip[] = [];
    for (const subjectId of subjectIds) {
      if (!existingIds.has(subjectId)) {
        skipped.push({ subjectId, reason: 'subject_not_found' });
      } else if (activeSubjectIds.has(subjectId)) {
        skipped.push({ subjectId, reason: 'already_enrolled' });
      } else {
        eligible.push(subjectId);
      }
    }
    return { eligible, skipped };
  }

  /** Called by PaymentService after a webhook confirms payment — never from a client
   * request directly. Same validation/conflict rules as grantEnrollment, just sourced
   * from a purchase instead of an admin action (grantedBy stays null). `batchId` is
   * set when this purchase was one line of a multi-subject batch checkout. */
  async fulfillPurchase(params: {
    userId: number;
    subjectId: number;
    tier: EnrollmentTierEnum;
    price: number;
    currency: string;
    reference: string;
    batchId?: number | null;
  }): Promise<SkillEnrollment> {
    return this.createEnrollment({
      userId: params.userId,
      subjectId: params.subjectId,
      tier: params.tier,
      source: EnrollmentSourceEnum.Purchase,
      price: params.price,
      currency: params.currency,
      reference: params.reference,
      grantedBy: null,
      note: null,
      batchId: params.batchId ?? null,
    });
  }

  /** Batch-header lifecycle helpers used by PaymentService's paid batch checkout —
   * SkillEnrollmentService owns the EnrollmentBatch table (see module wiring), so
   * PaymentService (which already depends on this service) goes through these rather
   * than getting its own repo. */
  async createPendingBatch(params: {
    userId: number;
    jobRoleId: number | null;
    tier: EnrollmentTierEnum;
    totalAmount: number;
    currency: string;
  }): Promise<EnrollmentBatch> {
    return this.batchRepo.save(
      this.batchRepo.create({
        userId: params.userId,
        jobRoleId: params.jobRoleId,
        tier: params.tier,
        status: EnrollmentBatchStatusEnum.Pending,
        source: EnrollmentSourceEnum.Purchase,
        totalAmount: params.totalAmount,
        currency: params.currency,
      }),
    );
  }

  async completeBatch(
    batchId: number,
    status: EnrollmentBatchStatusEnum.Completed | EnrollmentBatchStatusEnum.PartiallyCompleted | EnrollmentBatchStatusEnum.Failed,
  ): Promise<void> {
    await this.batchRepo.update(batchId, { status, completedAt: new Date() });
  }

  /** Check-then-insert (existingActive lookup, then save) is a classic TOCTOU race:
   * two near-simultaneous calls for the same (userId, subjectId) — e.g. a gateway
   * retrying/duplicating a webhook delivery, or a double-clicked enroll button — can
   * both pass findActiveEnrollment before either commits its save, producing two
   * Active rows for the same subject. There's no DB-level unique constraint to fall
   * back on (MySQL has no partial/filtered unique index, and a plain unique index on
   * (userId, subjectId) would wrongly block re-enrollment after a cancel/expiry), so
   * the whole check-then-insert is serialized per (userId, subjectId) with a MySQL
   * named lock — closes the gap even on the very first enrollment, where there's no
   * existing row yet to lock with SELECT ... FOR UPDATE. GET_LOCK/RELEASE_LOCK are
   * scoped to the connection that acquired them, so a dedicated QueryRunner is held
   * for the duration — a pooled repo.query() call can silently land on a different
   * physical connection each time, which would break the release. */
  private async createEnrollment(params: {
    userId: number;
    subjectId: number;
    tier: EnrollmentTierEnum;
    months?: number;
    source: EnrollmentSourceEnum;
    price: number | null;
    currency: string | null;
    reference: string | null;
    grantedBy: number | null;
    note: string | null;
    batchId?: number | null;
  }): Promise<SkillEnrollment> {
    const lockKey = `skill_enrollment:${params.userId}:${params.subjectId}`;
    const queryRunner = this.enrollmentRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.query('SELECT GET_LOCK(?, 10)', [lockKey]);
      return await this.createEnrollmentLocked(params, queryRunner.manager);
    } finally {
      await queryRunner.query('SELECT RELEASE_LOCK(?)', [lockKey]).catch(() => undefined);
      await queryRunner.release();
    }
  }

  private async createEnrollmentLocked(
    params: {
      userId: number;
      subjectId: number;
      tier: EnrollmentTierEnum;
      months?: number;
      source: EnrollmentSourceEnum;
      price: number | null;
      currency: string | null;
      reference: string | null;
      grantedBy: number | null;
      note: string | null;
      batchId?: number | null;
    },
    manager: EntityManager,
  ): Promise<SkillEnrollment> {
    const isBasic = params.tier === EnrollmentTierEnum.Basic;

    await this.assertSubjectExists(params.subjectId, manager);
    // Basic needs no SkillTierOffering — every subject is Basic-eligible unconditionally.
    const offering = isBasic
      ? null
      : await this.assertSubjectOffersTier(params.subjectId, params.tier, manager);

    const existingActive = await this.findActiveEnrollment(params.userId, params.subjectId, manager);
    if (existingActive) {
      throw new AppCustomException(
        HttpStatus.CONFLICT,
        `This user already has an active enrollment for this subject. Revoke it first to change tiers.`,
      );
    }

    const startAt = new Date();
    // Basic never expires — a one-time free activation, not a renewable window like
    // every paid tier.
    let expiresAt: Date | null = null;
    if (!isBasic) {
      const months =
        params.months ?? offering?.durationMonths ?? DEFAULT_TIER_DURATION_MONTHS[params.tier];
      expiresAt = new Date(startAt);
      expiresAt.setMonth(expiresAt.getMonth() + months);
    }

    const enrollment = manager.create(SkillEnrollment, {
      userId: params.userId,
      subjectId: params.subjectId,
      tier: params.tier,
      status: EnrollmentStatusEnum.Active,
      source: params.source,
      price: params.price,
      currency: params.currency,
      reference: params.reference,
      startAt,
      expiresAt,
      grantedBy: params.grantedBy,
      note: params.note,
      batchId: params.batchId ?? null,
    });

    return manager.save(SkillEnrollment, enrollment);
  }

  async assertSubjectExists(
    subjectId: number,
    manager: EntityManager = this.subjectRepo.manager,
  ): Promise<void> {
    const subject = await manager.findOne(Subject, { where: { id: subjectId } });
    if (!subject) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Subject ${subjectId} not found.`);
    }
  }

  /** Throws if the subject hasn't declared this tier as offered (or it's been
   * deactivated) — a resource-thin subject with no SME support simply has no
   * Intern/Serious row. Returns the offering (if any) so callers can read its
   * price/duration overrides without a second query. */
  private async assertSubjectOffersTier(
    subjectId: number,
    tier: EnrollmentTierEnum,
    manager: EntityManager = this.tierOfferingRepo.manager,
  ): Promise<SkillTierOffering | null> {
    const offering = await manager.findOne(SkillTierOffering, {
      where: { subjectId, tier, isActive: true },
    });
    if (!offering) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `This subject does not offer the ${tier} plan.`,
      );
    }
    return offering;
  }

  /** Whether userId already holds an active (non-expired) enrollment for this subject,
   * regardless of tier — exposed for PaymentService to short-circuit checkout before
   * creating a gateway order for a subject the user is already enrolled in. */
  async hasActiveEnrollment(userId: number, subjectId: number): Promise<boolean> {
    return !!(await this.findActiveEnrollment(userId, subjectId));
  }

  async revokeEnrollment(id: number, reason?: string): Promise<SkillEnrollment> {
    const enrollment = await this.enrollmentRepo.findOne({ where: { id } });
    if (!enrollment) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Enrollment ${id} not found.`,
      );
    }
    if (enrollment.status === EnrollmentStatusEnum.Cancelled) {
      throw new AppCustomException(
        HttpStatus.CONFLICT,
        `Enrollment ${id} is already cancelled.`,
      );
    }

    enrollment.status = EnrollmentStatusEnum.Cancelled;
    enrollment.cancelledAt = new Date();
    enrollment.cancelReason = reason ?? null;
    return this.enrollmentRepo.save(enrollment);
  }

  async listMine(userId: number): Promise<SubjectEnrollmentSummary[]> {
    const rows = await this.enrollmentRepo.find({
      where: { userId },
      order: { id: 'DESC' },
    });
    return this.attachSubjectNames(rows);
  }

  async listAll(filters: {
    userId?: number;
    status?: EnrollmentStatusEnum;
  }): Promise<SubjectEnrollmentSummary[]> {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;

    const rows = await this.enrollmentRepo.find({
      where,
      relations: ['user'],
      order: { id: 'DESC' },
    });
    return this.attachSubjectNames(rows);
  }

  // ---------------------------------------------------------------------------
  // Tier-aware access
  // ---------------------------------------------------------------------------

  /** subjectId -> active tier this user holds for it. Subjects with no active
   * enrollment (including no Basic row) are simply absent from the map — callers must
   * treat that as "not enrolled at all," NOT as Basic. Basic is only ever in this map
   * when the user actually called enrollBasic() for that subject. Direct read of
   * SkillEnrollment now that it's subject-only — no JobRoleSubject propagation
   * involved, since job roles aren't an enrollment scope. */
  async getSubjectTierMap(userId: number): Promise<Map<number, EnrollmentTierEnum>> {
    const now = new Date();
    const active = await this.enrollmentRepo
      .createQueryBuilder('e')
      .where('e.userId = :userId', { userId })
      .andWhere('e.status = :status', { status: EnrollmentStatusEnum.Active })
      .andWhere('(e.expiresAt IS NULL OR e.expiresAt > :now)', { now })
      .getMany();

    return new Map(active.map((e) => [e.subjectId, e.tier]));
  }

  /** Effective tier for one subject — `null` means "not enrolled at all" (not even
   * Basic), which callers must treat as zero access on a premium subject. Always
   * `null` for an anonymous caller, since enrolling (even in free Basic) requires an
   * account. Non-premium subjects are unaffected by any of this — see callers. */
  async getUserTierForSubject(
    userId: number | undefined,
    subjectId: number,
  ): Promise<EnrollmentTierEnum | null> {
    if (!userId) return null;
    const map = await this.getSubjectTierMap(userId);
    return map.get(subjectId) ?? null;
  }

  /** Personalization/history semantics — deliberately looser than getSubjectTierMap's
   * real-access check: `status != cancelled`, not `status = active AND not expired`.
   * A naturally expired paid enrollment still counts as "my subjects" for feed/
   * dashboard purposes; only an explicit revoke removes it from here. Used by
   * anything that used to read the now-removed UserSubject table for this same
   * "what has this user engaged with" signal (lesson discovery feed, etc.) — never
   * for gating real content access, which always goes through getSubjectTierMap /
   * getUserTierForSubject instead. */
  async getEnrolledSubjectIds(userId: number): Promise<number[]> {
    const rows = await this.enrollmentRepo
      .createQueryBuilder('e')
      .select('DISTINCT e.subjectId', 'subjectId')
      .where('e.userId = :userId', { userId })
      .andWhere('e.status != :cancelledStatus', { cancelledStatus: EnrollmentStatusEnum.Cancelled })
      .getRawMany();
    return rows.map((r) => +r.subjectId);
  }

  /** The MINIMUM effective tier across a set of subjects — non-premium
   * (`isPremium: false`) subjects count as Pro (always unlimited, never drag the
   * minimum down) regardless of enrollment. `null` means at least one *premium*
   * subject in the set has no active enrollment at all (not even Basic) — callers
   * must block outright, not apply Basic's capped treatment. Used to gate content
   * spanning several subjects at once (e.g. a UserQuiz built from multiple topics):
   * access is all-or-nothing per request. */
  async getMinEffectiveTierForSubjects(
    userId: number | undefined,
    subjectIds: number[],
  ): Promise<EnrollmentTierEnum | null> {
    const uniqueIds = Array.from(new Set(subjectIds));
    if (!uniqueIds.length) return EnrollmentTierEnum.Pro;

    const subjects = await this.subjectRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'isPremium'],
    });
    const tierMap = userId ? await this.getSubjectTierMap(userId) : new Map<number, EnrollmentTierEnum>();

    let minTier: EnrollmentTierEnum = EnrollmentTierEnum.Serious;
    for (const subject of subjects) {
      if (!subject.isPremium) continue;
      const effective = tierMap.get(subject.id);
      if (!effective) return null;
      if (TIER_RANK[effective] < TIER_RANK[minTier]) minTier = effective;
    }
    return minTier;
  }

  /** Job roles derived from real enrollment — never stored, computed live: every role
   * where the user holds at least one currently-active SkillEnrollment among the
   * role's subjects (via JobRoleSubject). Distinct from UserJobRole (targeting) — a
   * user can be derived-enrolled in a role they never explicitly targeted, and vice
   * versa (targeting a role implies zero access on its own). Used by the Career
   * Dashboard to show real progress alongside explicit targets. */
  async getDerivedJobRoleIds(userId: number): Promise<number[]> {
    const tierMap = await this.getSubjectTierMap(userId);
    if (!tierMap.size) return [];

    const subjectIds = Array.from(tierMap.keys());
    const rows = await this.jobRoleSubjectRepo
      .createQueryBuilder('jrs')
      .select('DISTINCT jrs.jobRoleId', 'jobRoleId')
      .where('jrs.subjectId IN (:...subjectIds)', { subjectIds })
      .getRawMany();
    return rows.map((r) => +r.jobRoleId);
  }

  /** Login-response / dashboard summary of the caller's real access. Deliberately built
   * as a thin composition of existing reads rather than a new bespoke query, so there's
   * one definition of "active" (getSubjectTierMap's, via listMine's isCurrentlyActive
   * flag) and one definition of "which job roles this subject-enrollment implies"
   * (getDerivedJobRoleIds + getJobRoleSubjectsBreakdown) — both already used elsewhere
   * (enrollments/me, Career Dashboard, job-role browsing). A job-role entry here has the
   * exact same shape as GET /apis/enrollments/job-role/:id/subjects, so a frontend
   * already rendering that endpoint can reuse its component as-is. subjectEnrollments
   * is filtered to isCurrentlyActive — unlike listMine()'s own full history — since a
   * cancelled/expired row shouldn't count for a login redirect decision. Not the
   * cheapest possible query plan (getSubjectTierMap runs once per derived job role via
   * getJobRoleSubjectsBreakdown), but login/dashboard reads happen at human, not
   * request-hot-path, frequency, and a typical user has a handful of job roles at most. */
  async getMyEnrollmentSummary(userId: number): Promise<{
    subjectEnrollments: SubjectEnrollmentSummary[];
    jobRoleEnrollments: JobRoleSubjectsBreakdown[];
  }> {
    const [mine, derivedJobRoleIds] = await Promise.all([
      this.listMine(userId),
      this.getDerivedJobRoleIds(userId),
    ]);

    const subjectEnrollments = mine.filter((e) => e.isCurrentlyActive);
    const jobRoleEnrollments = await Promise.all(
      derivedJobRoleIds.map((jobRoleId) => this.getJobRoleSubjectsBreakdown(userId, jobRoleId)),
    );

    return { subjectEnrollments, jobRoleEnrollments };
  }

  /** For the "check my access to this subject" endpoint. */
  async getSubjectAccessInfo(
    userId: number | undefined,
    subjectId: number,
  ): Promise<{
    subjectId: number;
    tier: EnrollmentTierEnum | null;
    isPremium: boolean;
    availableTiers: EnrollmentTierEnum[];
  }> {
    const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
    if (!subject) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Subject ${subjectId} not found.`);
    }

    const [tier, availableTiers] = await Promise.all([
      this.getUserTierForSubject(userId, subjectId),
      this.listAvailableTiers(subjectId),
    ]);

    return { subjectId, tier, isPremium: subject.isPremium, availableTiers };
  }

  /** Batch counterpart to getSubjectAccessInfo — one query per underlying table (tier
   * map, subjects, tier offerings) instead of N — for the job-role subject-picker/
   * enrollment-panel summary, which otherwise fires one `access/subject/:id` HTTP
   * request per subject the role covers (the "20+ requests in the network tab" flood).
   * Unknown subject ids are silently dropped rather than erroring — callers already
   * have a known-good subject list from JobRoleSubject/master data, not user input. */
  async getSubjectAccessInfoBatch(
    userId: number | undefined,
    subjectIds: number[],
  ): Promise<
    {
      subjectId: number;
      tier: EnrollmentTierEnum | null;
      isPremium: boolean;
      availableTiers: EnrollmentTierEnum[];
    }[]
  > {
    const uniqueIds = Array.from(new Set(subjectIds));
    if (!uniqueIds.length) return [];

    const [subjects, tierMap, offerings] = await Promise.all([
      this.subjectRepo.find({ where: { id: In(uniqueIds) } }),
      userId ? this.getSubjectTierMap(userId) : Promise.resolve(new Map<number, EnrollmentTierEnum>()),
      this.tierOfferingRepo.find({ where: { subjectId: In(uniqueIds), isActive: true } }),
    ]);

    const offeringsBySubject = new Map<number, EnrollmentTierEnum[]>();
    for (const o of offerings) {
      const list = offeringsBySubject.get(o.subjectId) ?? [];
      list.push(o.tier);
      offeringsBySubject.set(o.subjectId, list);
    }

    return subjects.map((subject) => ({
      subjectId: subject.id,
      tier: tierMap.get(subject.id) ?? null,
      isPremium: subject.isPremium,
      availableTiers: [EnrollmentTierEnum.Basic, ...(offeringsBySubject.get(subject.id) ?? [])],
    }));
  }

  /** Read-only browsing view for a job role — job roles are not an enrollment scope,
   * so there is no top-level "tier" here, just a per-subject breakdown of everything
   * that role's curriculum covers (via JobRoleSubject), each with the caller's real,
   * independently-enrolled subject tier. Enrolling means enrolling in one or more of
   * these subjects individually, not "enrolling in the job role." */
  async getJobRoleSubjectsBreakdown(
    userId: number | undefined,
    jobRoleId: number,
  ): Promise<JobRoleSubjectsBreakdown> {
    const jobRole = await this.jobRoleRepo.findOne({ where: { id: jobRoleId } });
    if (!jobRole) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Job role ${jobRoleId} not found.`);
    }

    const [links, subjectTierMap] = await Promise.all([
      this.jobRoleSubjectRepo.find({ where: { jobRoleId } }),
      userId ? this.getSubjectTierMap(userId) : Promise.resolve(new Map<number, EnrollmentTierEnum>()),
    ]);

    const subjects = links.map((link) => ({
      subjectId: link.subjectId,
      title: link.subject?.title ?? '',
      tier: subjectTierMap.get(link.subjectId) ?? null,
      isPremium: link.subject?.isPremium ?? true,
      tag: link.tag,
    }));

    return { jobRoleId, jobRoleTitle: jobRole.title, subjects };
  }

  // ---------------------------------------------------------------------------
  // Tier offerings — which tiers a subject sells
  // ---------------------------------------------------------------------------

  async upsertTierOffering(
    dto: UpsertTierOfferingDto,
    createdBy: number,
  ): Promise<SkillTierOffering> {
    if (dto.tier === EnrollmentTierEnum.Basic) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Basic is universal/implicit and cannot be declared as an offering.',
      );
    }
    await this.assertSubjectExists(dto.subjectId);
    return this.saveTierOffering(dto.subjectId, dto.tier, dto, createdBy);
  }

  /** Shared upsert core for the single-item and batch endpoints — one place that
   * knows "existing row wins, price/duration are a full replace not a partial patch,
   * every upsert (re)activates." Callers are responsible for the subject-exists and
   * not-Basic checks (batch does them once per subject/tier up front instead of
   * per-pair, to stay a bounded number of queries regardless of batch size). */
  private async saveTierOffering(
    subjectId: number,
    tier: EnrollmentTierEnum,
    overrides: { priceInr?: number; priceUsd?: number; durationMonths?: number },
    createdBy: number,
  ): Promise<SkillTierOffering> {
    const existing = await this.tierOfferingRepo.findOne({ where: { subjectId, tier } });

    const row = existing ?? this.tierOfferingRepo.create({ subjectId, tier, createdBy });
    row.priceInr = overrides.priceInr ?? null;
    row.priceUsd = overrides.priceUsd ?? null;
    row.durationMonths = overrides.durationMonths ?? null;
    row.isActive = true;

    return this.tierOfferingRepo.save(row);
  }

  /** Declares (or updates/reactivates) tiers for many subjects in one call — the
   * cross-product of `dto.subjectIds x dto.tiers`, all sharing the same price/duration
   * override (if any). This is the manageable counterpart to the single-item endpoint
   * above: onboarding a new subject's full paid ladder is one call instead of one per
   * tier. Skip-and-proceed, same philosophy as enrollBasicBatch — an unknown
   * subjectId or a Basic entry in `tiers` is dropped and reported in `skipped[]`
   * rather than failing every pair in the batch. */
  async batchUpsertTierOfferings(
    dto: BatchUpsertTierOfferingsDto,
    createdBy: number,
  ): Promise<{ saved: SkillTierOffering[]; skipped: TierOfferingBatchSkip[] }> {
    const subjectIds = Array.from(new Set(dto.subjectIds));
    const tiers = Array.from(new Set(dto.tiers));

    const subjects = await this.subjectRepo.find({ where: { id: In(subjectIds) }, select: ['id'] });
    const existingSubjectIds = new Set(subjects.map((s) => s.id));

    const saved: SkillTierOffering[] = [];
    const skipped: TierOfferingBatchSkip[] = [];

    for (const subjectId of subjectIds) {
      if (!existingSubjectIds.has(subjectId)) {
        tiers.forEach((tier) => skipped.push({ subjectId, tier, reason: 'subject_not_found' }));
        continue;
      }
      for (const tier of tiers) {
        if (tier === EnrollmentTierEnum.Basic) {
          skipped.push({ subjectId, tier, reason: 'basic_not_offerable' });
          continue;
        }
        saved.push(
          await this.saveTierOffering(
            subjectId,
            tier,
            { priceInr: dto.priceInr, priceUsd: dto.priceUsd, durationMonths: dto.durationMonths },
            createdBy,
          ),
        );
      }
    }

    return { saved, skipped };
  }

  async deactivateTierOffering(id: number): Promise<SkillTierOffering> {
    const offering = await this.tierOfferingRepo.findOne({ where: { id } });
    if (!offering) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Tier offering ${id} not found.`);
    }
    offering.isActive = false;
    return this.tierOfferingRepo.save(offering);
  }

  /** Batch counterpart to deactivateTierOffering — same subjectIds x tiers
   * cross-product as the batch upsert above, so "remove a plan from a bunch of
   * subjects" is symmetric with "assign a plan to a bunch of subjects." A pair with
   * no offering row at all, or one already inactive, is skipped and reported rather
   * than failing the batch. Existing enrollments at a deactivated tier are
   * unaffected — this only blocks new grants/purchases, same as the single-item version. */
  async batchDeactivateTierOfferings(
    dto: BatchDeactivateTierOfferingsDto,
  ): Promise<{ deactivated: SkillTierOffering[]; skipped: TierOfferingBatchSkip[] }> {
    const subjectIds = Array.from(new Set(dto.subjectIds));
    const tiers = Array.from(new Set(dto.tiers));

    const rows = await this.tierOfferingRepo.find({
      where: { subjectId: In(subjectIds), tier: In(tiers) },
    });
    const rowByKey = new Map(rows.map((r) => [`${r.subjectId}:${r.tier}`, r]));

    const toDeactivate: SkillTierOffering[] = [];
    const skipped: TierOfferingBatchSkip[] = [];

    for (const subjectId of subjectIds) {
      for (const tier of tiers) {
        const row = rowByKey.get(`${subjectId}:${tier}`);
        if (!row) {
          skipped.push({ subjectId, tier, reason: 'offering_not_found' });
          continue;
        }
        if (!row.isActive) {
          skipped.push({ subjectId, tier, reason: 'already_inactive' });
          continue;
        }
        row.isActive = false;
        toDeactivate.push(row);
      }
    }

    const deactivated = toDeactivate.length
      ? await this.tierOfferingRepo.save(toDeactivate)
      : [];

    return { deactivated, skipped };
  }

  async listTierOfferings(subjectId: number): Promise<SkillTierOffering[]> {
    return this.tierOfferingRepo.find({
      where: { subjectId, isActive: true },
      order: { tier: 'ASC' },
    });
  }

  /** Read-only management view across many subjects at once — what a "manage plans"
   * admin screen needs to render a subject x tier grid without N requests. Includes
   * inactive offerings too (unlike listTierOfferings, which is the public "what can I
   * currently buy" read) so an admin can see what was previously offered and removed. */
  async listTierOfferingsForSubjects(subjectIds: number[]): Promise<SkillTierOffering[]> {
    if (!subjectIds.length) return [];
    return this.tierOfferingRepo.find({
      where: { subjectId: In(subjectIds) },
      order: { subjectId: 'ASC', tier: 'ASC' },
    });
  }

  /** Batch counterpart to listTierOfferings — active-only, for the job-role
   * subject-picker/enrollment-panel summary (same batching rationale as
   * getSubjectAccessInfoBatch above: one HTTP round trip instead of one per subject).
   * Unlike the admin-only listTierOfferingsForSubjects, this never includes inactive
   * rows — it's the public "what can I currently buy" contract, same as the
   * single-subject listTierOfferings(). */
  async listTierOfferingsForSubjectsPublic(subjectIds: number[]): Promise<SkillTierOffering[]> {
    const uniqueIds = Array.from(new Set(subjectIds));
    if (!uniqueIds.length) return [];
    return this.tierOfferingRepo.find({
      where: { subjectId: In(uniqueIds), isActive: true },
      order: { subjectId: 'ASC', tier: 'ASC' },
    });
  }

  /** Basic is always implicitly available — every subject offers it. */
  private async listAvailableTiers(subjectId: number): Promise<EnrollmentTierEnum[]> {
    const offerings = await this.listTierOfferings(subjectId);
    return [EnrollmentTierEnum.Basic, ...offerings.map((o) => o.tier)];
  }

  /** Reads a subject's tier-offering row (if any) — used by PaymentService to apply
   * price/duration overrides at checkout time. */
  async getTierOffering(
    subjectId: number,
    tier: EnrollmentTierEnum,
  ): Promise<SkillTierOffering | null> {
    return this.tierOfferingRepo.findOne({
      where: { subjectId, tier, isActive: true },
    });
  }

  // ---------------------------------------------------------------------------
  // Subject.isPremium — the per-subject "free showcase" escape hatch
  // ---------------------------------------------------------------------------

  /** No general Subject-update endpoint exists anywhere in this codebase (subjects
   * are otherwise seed-managed) — this is a narrow, single-purpose toggle rather than
   * a full Subject CRUD surface, since that's out of scope here. */
  async setSubjectPremiumFlag(subjectId: number, isPremium: boolean): Promise<Subject> {
    const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
    if (!subject) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Subject ${subjectId} not found.`);
    }
    subject.isPremium = isPremium;
    return this.subjectRepo.save(subject);
  }

  // ---------------------------------------------------------------------------
  // Tier daily-cap config (admin-editable, replaces hardcoded constants)
  // ---------------------------------------------------------------------------

  async getCapsForTier(
    tier: EnrollmentTierEnum,
  ): Promise<{ dailyQuizCap: number; dailyLessonCap: number } | null> {
    const row = await this.tierCapConfigRepo.findOne({ where: { tier } });
    if (row) return { dailyQuizCap: row.dailyQuizCap, dailyLessonCap: row.dailyLessonCap };
    return DEFAULT_TIER_CAPS[tier] ?? null;
  }

  async upsertTierCapConfig(
    tier: EnrollmentTierEnum,
    dailyQuizCap: number,
    dailyLessonCap: number,
  ): Promise<EnrollmentTierCapConfig> {
    const existing = await this.tierCapConfigRepo.findOne({ where: { tier } });
    const row = existing ?? this.tierCapConfigRepo.create({ tier });
    row.dailyQuizCap = dailyQuizCap;
    row.dailyLessonCap = dailyLessonCap;
    return this.tierCapConfigRepo.save(row);
  }

  async listTierCapConfigs(): Promise<EnrollmentTierCapConfig[]> {
    return this.tierCapConfigRepo.find({ order: { tier: 'ASC' } });
  }

  /** The caller's own multi-subject enrollment actions, newest first, each with the
   * subjects actually enrolled under it so far. A Pending/Failed paid batch shows an
   * empty `items` list until its webhook fulfills at least one subject — the
   * underlying payment attempt itself is visible via GET /apis/payments/orders/me in
   * the meantime; this endpoint is about grants, not payment attempts. */
  async listMyBatches(userId: number): Promise<any[]> {
    const batches = await this.batchRepo.find({ where: { userId }, order: { id: 'DESC' } });
    if (!batches.length) return [];

    const batchIds = batches.map((b) => b.id);
    const enrollments = await this.enrollmentRepo.find({ where: { batchId: In(batchIds) } });

    const subjectIds = Array.from(new Set(enrollments.map((e) => e.subjectId)));
    const subjects = subjectIds.length
      ? await this.subjectRepo.find({ where: { id: In(subjectIds) }, select: ['id', 'title'] })
      : [];
    const subjectMap = new Map(subjects.map((s) => [s.id, s.title]));

    const itemsByBatch = new Map<number, any[]>();
    for (const e of enrollments) {
      const list = itemsByBatch.get(e.batchId) ?? [];
      list.push({
        subjectId: e.subjectId,
        subjectName: subjectMap.get(e.subjectId) ?? null,
        skillEnrollmentId: e.id,
        enrollmentStatus: e.status,
      });
      itemsByBatch.set(e.batchId, list);
    }

    return batches.map((batch) => ({ ...batch, items: itemsByBatch.get(batch.id) ?? [] }));
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async findActiveEnrollment(
    userId: number,
    subjectId: number,
    manager: EntityManager = this.enrollmentRepo.manager,
  ): Promise<SkillEnrollment | null> {
    const now = new Date();
    return manager
      .createQueryBuilder(SkillEnrollment, 'e')
      .where('e.userId = :userId', { userId })
      .andWhere('e.subjectId = :subjectId', { subjectId })
      .andWhere('e.status = :status', { status: EnrollmentStatusEnum.Active })
      .andWhere('(e.expiresAt IS NULL OR e.expiresAt > :now)', { now })
      .getOne();
  }

  private async attachSubjectNames(rows: SkillEnrollment[]): Promise<SubjectEnrollmentSummary[]> {
    const subjectIds = rows.map((r) => r.subjectId);
    const subjects = subjectIds.length
      ? await this.subjectRepo.find({ where: { id: In(subjectIds) }, select: ['id', 'title'] })
      : [];
    const subjectMap = new Map(subjects.map((s) => [s.id, s.title]));
    const now = new Date();

    return rows.map((r) => ({
      ...r,
      subjectName: subjectMap.get(r.subjectId) ?? null,
      isCurrentlyActive:
        r.status === EnrollmentStatusEnum.Active && (!r.expiresAt || r.expiresAt > now),
    }));
  }
}
