import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SkillEnrollment } from 'src/common/typeorm/entities/skill-enrollment.entity';
import { EnrollmentBatch } from 'src/common/typeorm/entities/enrollment-batch.entity';
import { SkillTierOffering } from 'src/common/typeorm/entities/skill-tier-offering.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { EnrollmentStatusEnum } from 'src/common/enum/enrollment-status.enum';
import { EnrollmentSourceEnum } from 'src/common/enum/enrollment-source.enum';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';
import { EnrollmentBatchStatusEnum } from 'src/common/enum/enrollment-batch-status.enum';

@Injectable()
export class AdminEnrollmentsService {
  constructor(
    @InjectRepository(SkillEnrollment)
    private readonly enrollmentRepo: Repository<SkillEnrollment>,

    @InjectRepository(EnrollmentBatch)
    private readonly batchRepo: Repository<EnrollmentBatch>,

    @InjectRepository(SkillTierOffering)
    private readonly tierOfferingRepo: Repository<SkillTierOffering>,

    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
  ) {}

  async getEnrollmentStats() {
    const [summary, byTier, bySource, conversion, growth, expiringSoon, topSubjectsRaw, batches, plans] =
      await Promise.all([
        this.getSummary(),
        this.getByTier(),
        this.getBySource(),
        this.getConversion(),
        this.getGrowth(),
        this.getExpiringSoon(),
        this.getTopSubjectsRaw(),
        this.getBatchStats(),
        this.getPlanStats(),
      ]);

    const topSubjectsByActiveEnrollments = await this.attachSubjectTitles(topSubjectsRaw);

    return {
      summary,
      byTier,
      bySource,
      conversion,
      growth,
      expiringSoon,
      topSubjectsByActiveEnrollments,
      batches,
      plans,
    };
  }

  private async getSummary() {
    const result = await this.enrollmentRepo
      .createQueryBuilder('e')
      .select([
        'COUNT(e.id) as total',
        `SUM(CASE WHEN e.status = :active THEN 1 ELSE 0 END) as active`,
        `SUM(CASE WHEN e.status = :expired THEN 1 ELSE 0 END) as expired`,
        `SUM(CASE WHEN e.status = :cancelled THEN 1 ELSE 0 END) as cancelled`,
        `COUNT(DISTINCT CASE WHEN e.status = :active THEN e.userId END) as uniqueActiveUsers`,
      ])
      .setParameters({
        active: EnrollmentStatusEnum.Active,
        expired: EnrollmentStatusEnum.Expired,
        cancelled: EnrollmentStatusEnum.Cancelled,
      })
      .getRawOne();

    return {
      total: +result.total || 0,
      active: +result.active || 0,
      expired: +result.expired || 0,
      cancelled: +result.cancelled || 0,
      uniqueActiveUsers: +result.uniqueActiveUsers || 0,
    };
  }

  private async getByTier() {
    const rows = await this.enrollmentRepo
      .createQueryBuilder('e')
      .select(['e.tier as tier', 'COUNT(e.id) as count'])
      .where('e.status = :active', { active: EnrollmentStatusEnum.Active })
      .groupBy('e.tier')
      .getRawMany();

    const byTier = { basic: 0, curious: 0, pro: 0, intern: 0, serious: 0 };
    for (const row of rows) {
      const count = +row.count || 0;
      if (row.tier === EnrollmentTierEnum.Basic) byTier.basic = count;
      else if (row.tier === EnrollmentTierEnum.Curious) byTier.curious = count;
      else if (row.tier === EnrollmentTierEnum.Pro) byTier.pro = count;
      else if (row.tier === EnrollmentTierEnum.Intern) byTier.intern = count;
      else if (row.tier === EnrollmentTierEnum.Serious) byTier.serious = count;
    }
    return byTier;
  }

  private async getBySource() {
    const rows = await this.enrollmentRepo
      .createQueryBuilder('e')
      .select(['e.source as source', 'COUNT(e.id) as count'])
      .where('e.status = :active', { active: EnrollmentStatusEnum.Active })
      .groupBy('e.source')
      .getRawMany();

    const bySource = { adminGrant: 0, purchase: 0, promo: 0 };
    for (const row of rows) {
      const count = +row.count || 0;
      if (row.source === EnrollmentSourceEnum.AdminGrant) bySource.adminGrant = count;
      else if (row.source === EnrollmentSourceEnum.Purchase) bySource.purchase = count;
      else if (row.source === EnrollmentSourceEnum.Promo) bySource.promo = count;
    }
    return bySource;
  }

  // "Paying" = holds at least one active enrollment above Basic — Basic is the sole free tier,
  // so tier <> Basic is equivalent to the TIER_RANK >= Curious check used elsewhere.
  private async getConversion() {
    const [{ count: payingUsers }, { count: uniqueActiveUsers }] = await Promise.all([
      this.enrollmentRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.userId)', 'count')
        .where('e.status = :active', { active: EnrollmentStatusEnum.Active })
        .andWhere('e.tier != :basic', { basic: EnrollmentTierEnum.Basic })
        .getRawOne(),
      this.enrollmentRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.userId)', 'count')
        .where('e.status = :active', { active: EnrollmentStatusEnum.Active })
        .getRawOne(),
    ]);

    const paying = +payingUsers || 0;
    const totalActive = +uniqueActiveUsers || 0;

    return {
      payingUsers: paying,
      freeOnlyUsers: totalActive - paying,
      conversionRate: totalActive > 0 ? +((paying / totalActive) * 100).toFixed(1) : 0,
    };
  }

  private async getGrowth() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 29);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.enrollmentRepo
      .createQueryBuilder('e')
      .select([
        `SUM(CASE WHEN e.createdAt >= :startOfToday THEN 1 ELSE 0 END) as newToday`,
        `SUM(CASE WHEN e.createdAt >= :startOfWeek THEN 1 ELSE 0 END) as newThisWeek`,
        `SUM(CASE WHEN e.createdAt >= :startOfMonth THEN 1 ELSE 0 END) as newThisMonth`,
      ])
      .setParameters({ startOfToday, startOfWeek, startOfMonth })
      .getRawOne();

    return {
      newToday: +result.newToday || 0,
      newThisWeek: +result.newThisWeek || 0,
      newThisMonth: +result.newThisMonth || 0,
    };
  }

  private async getExpiringSoon(): Promise<number> {
    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(now.getDate() + 7);

    return this.enrollmentRepo
      .createQueryBuilder('e')
      .where('e.status = :active', { active: EnrollmentStatusEnum.Active })
      .andWhere('e.expiresAt IS NOT NULL')
      .andWhere('e.expiresAt BETWEEN :now AND :in7Days', { now, in7Days })
      .getCount();
  }

  private getTopSubjectsRaw() {
    return this.enrollmentRepo
      .createQueryBuilder('e')
      .select(['e.subjectId as subjectId', 'COUNT(e.id) as count'])
      .where('e.status = :active', { active: EnrollmentStatusEnum.Active })
      .groupBy('e.subjectId')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();
  }

  private async attachSubjectTitles(rows: { subjectId: string | number; count: string | number }[]) {
    if (!rows.length) return [];
    const subjectIds = rows.map((r) => +r.subjectId);
    const subjects = await this.subjectRepo.findBy({ id: In(subjectIds) });
    const titleById = new Map(subjects.map((s) => [s.id, s.title]));
    return rows.map((r) => ({
      id: +r.subjectId,
      title: titleById.get(+r.subjectId) ?? 'Unknown',
      activeEnrollments: +r.count,
    }));
  }

  private async getBatchStats() {
    const result = await this.batchRepo
      .createQueryBuilder('b')
      .select([
        'COUNT(b.id) as total',
        `SUM(CASE WHEN b.status = :pending THEN 1 ELSE 0 END) as pending`,
        `SUM(CASE WHEN b.status = :completed THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN b.status = :partiallyCompleted THEN 1 ELSE 0 END) as partiallyCompleted`,
        `SUM(CASE WHEN b.status = :failed THEN 1 ELSE 0 END) as failed`,
      ])
      .setParameters({
        pending: EnrollmentBatchStatusEnum.Pending,
        completed: EnrollmentBatchStatusEnum.Completed,
        partiallyCompleted: EnrollmentBatchStatusEnum.PartiallyCompleted,
        failed: EnrollmentBatchStatusEnum.Failed,
      })
      .getRawOne();

    return {
      total: +result.total || 0,
      byStatus: {
        pending: +result.pending || 0,
        completed: +result.completed || 0,
        partiallyCompleted: +result.partiallyCompleted || 0,
        failed: +result.failed || 0,
      },
    };
  }

  private async getPlanStats() {
    const [totalActiveOfferings, premiumSubjectsWithoutPaidPlan] = await Promise.all([
      this.tierOfferingRepo.count({ where: { isActive: true } }),
      this.subjectRepo
        .createQueryBuilder('s')
        .where('s.isPremium = true')
        .andWhere(
          `NOT EXISTS (SELECT 1 FROM skill_tier_offering sto WHERE sto.subjectId = s.id AND sto.isActive = true)`,
        )
        .getCount(),
    ]);

    return { totalActiveOfferings, premiumSubjectsWithoutPaidPlan };
  }
}
