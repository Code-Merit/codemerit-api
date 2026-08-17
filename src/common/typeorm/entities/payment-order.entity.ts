import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';
import { PaymentProviderEnum } from 'src/common/enum/payment-provider.enum';
import { PaymentOrderStatusEnum } from 'src/common/enum/payment-order-status.enum';

// One row per checkout attempt. Created in `created` state when the gateway order/
// session is requested, flipped to `paid` (idempotently) by the matching webhook,
// which is also what fulfills the SkillEnrollment — never on the client's say-so.
@Index(['provider', 'providerOrderId'])
@Entity()
export class PaymentOrder extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  userId: number;

  @Column({ type: 'integer', nullable: false })
  subjectId: number;

  // Set when this row is one line of a multi-subject batch checkout (see
  // EnrollmentBatch) — every row sharing a batchId also shares providerOrderId/
  // providerPaymentId, since they're all settled by one real gateway transaction.
  // Null for today's ordinary single-subject checkout — unchanged behavior.
  @Column({ type: 'integer', nullable: true, default: null })
  batchId: number | null;

  @Column({ type: 'enum', enum: EnrollmentTierEnum, nullable: false })
  tier: EnrollmentTierEnum;

  @Column({ type: 'enum', enum: PaymentProviderEnum, nullable: false })
  provider: PaymentProviderEnum;

  // Razorpay order id ("order_xxx") or Stripe Checkout Session id ("cs_xxx") — the
  // value webhooks arrive keyed on, hence the index above.
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  providerOrderId: string | null;

  // Payment id captured once the webhook confirms success (Razorpay payment_id /
  // Stripe payment_intent) — distinct from providerOrderId, kept for reconciliation.
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  providerPaymentId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'varchar', length: 10, nullable: false })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentOrderStatusEnum,
    default: PaymentOrderStatusEnum.Created,
  })
  status: PaymentOrderStatusEnum;

  // Set once the webhook fulfills this order into an active SkillEnrollment.
  @Column({ type: 'integer', nullable: true, default: null })
  enrollmentId: number | null;

  @Column({ type: 'text', nullable: true, default: null })
  failureReason: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  paidAt: Date | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;
}
