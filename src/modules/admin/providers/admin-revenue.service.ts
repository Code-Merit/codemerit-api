import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentOrder } from 'src/common/typeorm/entities/payment-order.entity';
import { PaymentOrderStatusEnum } from 'src/common/enum/payment-order-status.enum';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

type CurrencyBucket = {
  totalOrders: number;
  byStatus: { created: number; paid: number; failed: number; cancelled: number };
  totalPaid: number;
  conversionRate: number;
  avgOrderValue: number;
};

const CURRENCIES = ['INR', 'USD'] as const;

// INR (Razorpay) and USD (Stripe) are separate ledgers — see payment.service.ts's
// resolveProviderForCurrency() — so every figure here is reported per currency; there is no
// blended total, which would silently mix two different monies into one meaningless number.
@Injectable()
export class AdminRevenueService {
  constructor(
    @InjectRepository(PaymentOrder)
    private readonly orderRepo: Repository<PaymentOrder>,
  ) {}

  async getRevenueStats() {
    const [byCurrency, windowRows, tierRows] = await Promise.all([
      this.getByCurrency(),
      this.getRevenueWindows(),
      this.getByTier(),
    ]);

    const paidThisWeek = this.emptyCurrencyMap();
    const paidThisMonth = this.emptyCurrencyMap();
    for (const row of windowRows) {
      if (row.currency !== 'INR' && row.currency !== 'USD') continue;
      paidThisWeek[row.currency] = +row.weekSum || 0;
      paidThisMonth[row.currency] = +row.monthSum || 0;
    }

    const byTier: Record<string, { INR: number; USD: number }> = {
      curious: this.emptyCurrencyMap(),
      pro: this.emptyCurrencyMap(),
      intern: this.emptyCurrencyMap(),
      serious: this.emptyCurrencyMap(),
    };
    for (const row of tierRows) {
      if (row.currency !== 'INR' && row.currency !== 'USD') continue;
      const tierKey = this.tierKey(row.tier);
      if (!tierKey) continue;
      byTier[tierKey][row.currency] = +row.sum || 0;
    }

    return { byCurrency, paidThisWeek, paidThisMonth, byTier };
  }

  private emptyCurrencyMap(): { INR: number; USD: number } {
    return { INR: 0, USD: 0 };
  }

  private tierKey(tier: string): 'curious' | 'pro' | 'intern' | 'serious' | null {
    if (tier === EnrollmentTierEnum.Curious) return 'curious';
    if (tier === EnrollmentTierEnum.Pro) return 'pro';
    if (tier === EnrollmentTierEnum.Intern) return 'intern';
    if (tier === EnrollmentTierEnum.Serious) return 'serious';
    return null; // Basic is never paid — no PaymentOrder row is ever created for it.
  }

  private async getByCurrency(): Promise<Record<'INR' | 'USD', CurrencyBucket>> {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select(['o.currency as currency', 'o.status as status', 'COUNT(o.id) as count', 'SUM(o.amount) as sum'])
      .groupBy('o.currency')
      .addGroupBy('o.status')
      .getRawMany();

    const result: Record<'INR' | 'USD', CurrencyBucket> = {
      INR: this.emptyBucket(),
      USD: this.emptyBucket(),
    };

    for (const row of rows) {
      if (row.currency !== 'INR' && row.currency !== 'USD') continue;
      const bucket = result[row.currency];
      const count = +row.count || 0;
      bucket.totalOrders += count;
      if (row.status === PaymentOrderStatusEnum.Created) bucket.byStatus.created = count;
      else if (row.status === PaymentOrderStatusEnum.Paid) {
        bucket.byStatus.paid = count;
        bucket.totalPaid = +row.sum || 0;
      } else if (row.status === PaymentOrderStatusEnum.Failed) bucket.byStatus.failed = count;
      else if (row.status === PaymentOrderStatusEnum.Cancelled) bucket.byStatus.cancelled = count;
    }

    for (const currency of CURRENCIES) {
      const bucket = result[currency];
      bucket.conversionRate =
        bucket.totalOrders > 0 ? +((bucket.byStatus.paid / bucket.totalOrders) * 100).toFixed(1) : 0;
      bucket.avgOrderValue =
        bucket.byStatus.paid > 0 ? +(bucket.totalPaid / bucket.byStatus.paid).toFixed(2) : 0;
    }

    return result;
  }

  private emptyBucket(): CurrencyBucket {
    return {
      totalOrders: 0,
      byStatus: { created: 0, paid: 0, failed: 0, cancelled: 0 },
      totalPaid: 0,
      conversionRate: 0,
      avgOrderValue: 0,
    };
  }

  private getRevenueWindows() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 29);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.orderRepo
      .createQueryBuilder('o')
      .select([
        'o.currency as currency',
        `SUM(CASE WHEN o.paidAt >= :startOfWeek THEN o.amount ELSE 0 END) as weekSum`,
        `SUM(CASE WHEN o.paidAt >= :startOfMonth THEN o.amount ELSE 0 END) as monthSum`,
      ])
      .where('o.status = :paid', { paid: PaymentOrderStatusEnum.Paid })
      .setParameters({ startOfWeek, startOfMonth })
      .groupBy('o.currency')
      .getRawMany();
  }

  private getByTier() {
    return this.orderRepo
      .createQueryBuilder('o')
      .select(['o.currency as currency', 'o.tier as tier', 'SUM(o.amount) as sum'])
      .where('o.status = :paid', { paid: PaymentOrderStatusEnum.Paid })
      .groupBy('o.currency')
      .addGroupBy('o.tier')
      .getRawMany();
  }
}
