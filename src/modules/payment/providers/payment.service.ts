import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { PaymentOrder } from 'src/common/typeorm/entities/payment-order.entity';
import { EnrollmentBatch } from 'src/common/typeorm/entities/enrollment-batch.entity';
import { PaymentProviderEnum } from 'src/common/enum/payment-provider.enum';
import { PaymentOrderStatusEnum } from 'src/common/enum/payment-order-status.enum';
import { EnrollmentBatchStatusEnum } from 'src/common/enum/enrollment-batch-status.enum';
import { IPaymentConfig } from 'src/config/payment-config';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { SkillEnrollmentService } from 'src/modules/skill-enrollment/providers/skill-enrollment.service';
import { DEFAULT_TIER_DURATION_MONTHS } from 'src/modules/skill-enrollment/constants/skill-enrollment.constants';
import { CreateCheckoutDto } from '../dtos/create-checkout.dto';
import { CreateBatchCheckoutDto } from '../dtos/create-batch-checkout.dto';
import { VerifyCheckoutDto } from '../dtos/verify-checkout.dto';
import { RazorpayProvider } from './razorpay.provider';
import { StripeProvider } from './stripe.provider';
import {
  getTierPrice,
  getFullPricingCatalog,
  isPaidTier,
  resolveProviderForCurrency,
} from '../constants/pricing-catalog.constants';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentOrder)
    private readonly orderRepo: Repository<PaymentOrder>,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly stripeProvider: StripeProvider,
    private readonly skillEnrollmentService: SkillEnrollmentService,
    private readonly configService: ConfigService,
    private readonly activityService: ActivityService,
  ) {}

  /** Public, no auth required — a pricing page needs this before a user has even
   * signed up. Same catalog createCheckout() prices off of, so what's displayed here
   * is always what checkout will actually charge. Also carries each tier's real daily
   * quiz/lesson caps + access-window duration (from SkillEnrollmentService/
   * EnrollmentTierCapConfig, the SAME source quiz.service.ts's enforcement and the
   * admin tier-caps screen read) — a frontend rendering "10 quizzes/day" from its own
   * hardcoded copy could silently drift from whatever an admin has actually configured;
   * this makes the pricing/checkout/upgrade surfaces read the real number instead. */
  async getPricingCatalog(): Promise<
    ReturnType<typeof getFullPricingCatalog> & {
      caps: Record<EnrollmentTierEnum, { dailyQuizCap: number | null; dailyLessonCap: number | null; durationMonths: number | null }>;
    }
  > {
    const founderPricingEnabled =
      this.configService.get<IPaymentConfig>('payment').founderPricingEnabled;
    const catalog = getFullPricingCatalog(founderPricingEnabled);

    const allTiers = Object.values(EnrollmentTierEnum);
    const capsEntries = await Promise.all(
      allTiers.map(async (tier) => {
        const tierCaps = await this.skillEnrollmentService.getCapsForTier(tier);
        const durationMonths =
          tier === EnrollmentTierEnum.Basic ? null : DEFAULT_TIER_DURATION_MONTHS[tier];
        return [
          tier,
          {
            dailyQuizCap: tierCaps?.dailyQuizCap ?? null,
            dailyLessonCap: tierCaps?.dailyLessonCap ?? null,
            durationMonths: durationMonths ?? null,
          },
        ] as const;
      }),
    );

    return { ...catalog, caps: Object.fromEntries(capsEntries) as Record<EnrollmentTierEnum, { dailyQuizCap: number | null; dailyLessonCap: number | null; durationMonths: number | null }> };
  }

  async createCheckout(userId: number, dto: CreateCheckoutDto): Promise<Record<string, any>> {
    if (!isPaidTier(dto.tier)) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Basic cannot be purchased — it is the implicit default for everyone.',
      );
    }

    await this.skillEnrollmentService.assertSubjectExists(dto.subjectId);

    const offering = await this.skillEnrollmentService.getTierOffering(
      dto.subjectId,
      dto.tier,
    );
    if (!offering) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `This subject does not offer the ${dto.tier} plan.`,
      );
    }

    const alreadyActive = await this.skillEnrollmentService.hasActiveEnrollment(
      userId,
      dto.subjectId,
    );
    if (alreadyActive) {
      throw new AppCustomException(
        HttpStatus.CONFLICT,
        `You already have an active enrollment for this subject.`,
      );
    }

    const founderPricingEnabled =
      this.configService.get<IPaymentConfig>('payment').founderPricingEnabled;
    const { amount, currency } = getTierPrice(dto.tier, dto.currency, founderPricingEnabled, {
      priceInr: offering.priceInr,
      priceUsd: offering.priceUsd,
    });
    const provider = resolveProviderForCurrency(dto.currency);

    let order = this.orderRepo.create({
      userId,
      subjectId: dto.subjectId,
      tier: dto.tier,
      provider,
      amount,
      currency,
      status: PaymentOrderStatusEnum.Created,
    });
    order = await this.orderRepo.save(order);

    return provider === PaymentProviderEnum.Razorpay
      ? this.beginRazorpayCheckout(order, dto)
      : this.beginStripeCheckout(order, dto);
  }

  private async beginRazorpayCheckout(
    order: PaymentOrder,
    dto: CreateCheckoutDto,
  ): Promise<Record<string, any>> {
    const rpOrder = await this.razorpayProvider.createOrder({
      amount: order.amount,
      currency: order.currency,
      receipt: `enrollment-${order.id}`,
      notes: {
        orderId: String(order.id),
        subjectId: String(dto.subjectId),
        userId: String(order.userId),
      },
    });

    order.providerOrderId = rpOrder.id;
    await this.orderRepo.save(order);

    return {
      provider: PaymentProviderEnum.Razorpay,
      orderId: order.id,
      razorpayOrderId: rpOrder.id,
      razorpayKeyId: this.razorpayProvider.getPublicKeyId(),
      amount: order.amount,
      currency: order.currency,
    };
  }

  private async beginStripeCheckout(
    order: PaymentOrder,
    dto: CreateCheckoutDto,
  ): Promise<Record<string, any>> {
    const frontendUrl = this.configService.get<string>('mail.frontendUrl');
    const productName = `CodeMerit Subject Enrollment — ${dto.tier}`;

    const session = await this.stripeProvider.createCheckoutSession({
      amount: order.amount,
      currency: order.currency,
      productName,
      successUrl: `${frontendUrl}/payments/success?orderId=${order.id}`,
      cancelUrl: `${frontendUrl}/payments/cancel?orderId=${order.id}`,
      metadata: {
        orderId: String(order.id),
        subjectId: String(dto.subjectId),
        userId: String(order.userId),
      },
    });

    order.providerOrderId = session.id;
    await this.orderRepo.save(order);

    return {
      provider: PaymentProviderEnum.Stripe,
      orderId: order.id,
      stripeSessionId: session.id,
      checkoutUrl: session.url,
      amount: order.amount,
      currency: order.currency,
    };
  }

  /** Paid counterpart of SkillEnrollmentService.enrollBasicBatch — check out several
   * subjects at one plan, in one gateway transaction. Skip-and-proceed, same as the
   * free path, plus one more reason ('tier_not_offered') since a paid tier isn't
   * universal like Basic. Neither Razorpay nor Stripe has a real line-item concept in
   * this codebase's wrappers, so the actual per-subject breakdown lives only in our
   * own PaymentOrder rows (one per eligible subject, all sharing batchId and the one
   * gateway order/session id) — the gateway itself just sees one summed amount. */
  async createBatchCheckout(
    userId: number,
    dto: CreateBatchCheckoutDto,
  ): Promise<Record<string, any>> {
    if (!isPaidTier(dto.tier)) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Basic cannot be purchased — use POST /apis/enrollments/enroll-basic/batch instead.',
      );
    }

    const uniqueIds = Array.from(new Set(dto.subjectIds));
    const { eligible, skipped } = await this.skillEnrollmentService.partitionSubjectsForEnrollment(
      userId,
      uniqueIds,
    );

    const founderPricingEnabled =
      this.configService.get<IPaymentConfig>('payment').founderPricingEnabled;

    const offerings = await this.skillEnrollmentService.listTierOfferingsForSubjects(eligible);
    const offeringBySubjectId = new Map(
      offerings.filter((o) => o.tier === dto.tier && o.isActive).map((o) => [o.subjectId, o]),
    );

    const eligibleItems: { subjectId: number; amount: number }[] = [];
    for (const subjectId of eligible) {
      const offering = offeringBySubjectId.get(subjectId);
      if (!offering) {
        skipped.push({ subjectId, reason: 'tier_not_offered' });
        continue;
      }
      const { amount } = getTierPrice(dto.tier, dto.currency, founderPricingEnabled, {
        priceInr: offering.priceInr,
        priceUsd: offering.priceUsd,
      });
      eligibleItems.push({ subjectId, amount });
    }

    if (!eligibleItems.length) {
      return {
        batchId: null,
        eligibleSubjectIds: [],
        skipped,
        totalAmount: 0,
        currency: dto.currency,
      };
    }

    const currency = dto.currency;
    const provider = resolveProviderForCurrency(currency);
    const totalAmount = eligibleItems.reduce((sum, item) => sum + item.amount, 0);

    const batch = await this.skillEnrollmentService.createPendingBatch({
      userId,
      jobRoleId: dto.jobRoleId ?? null,
      tier: dto.tier,
      totalAmount,
      currency,
    });

    const orders = await this.orderRepo.save(
      eligibleItems.map((item) =>
        this.orderRepo.create({
          userId,
          subjectId: item.subjectId,
          batchId: batch.id,
          tier: dto.tier,
          provider,
          amount: item.amount,
          currency,
          status: PaymentOrderStatusEnum.Created,
        }),
      ),
    );

    const gatewayResult =
      provider === PaymentProviderEnum.Razorpay
        ? await this.beginRazorpayBatchCheckout(batch, orders, totalAmount, currency)
        : await this.beginStripeBatchCheckout(batch, orders, totalAmount, currency);

    return {
      ...gatewayResult,
      batchId: batch.id,
      eligibleSubjectIds: eligibleItems.map((item) => item.subjectId),
      skipped,
      totalAmount,
      currency,
    };
  }

  private async beginRazorpayBatchCheckout(
    batch: EnrollmentBatch,
    orders: PaymentOrder[],
    totalAmount: number,
    currency: string,
  ): Promise<Record<string, any>> {
    const rpOrder = await this.razorpayProvider.createOrder({
      amount: totalAmount,
      currency,
      receipt: `enrollment-batch-${batch.id}`,
      notes: {
        batchId: String(batch.id),
        userId: String(batch.userId),
        subjectCount: String(orders.length),
      },
    });

    await this.orderRepo.update({ batchId: batch.id }, { providerOrderId: rpOrder.id });

    return {
      provider: PaymentProviderEnum.Razorpay,
      razorpayOrderId: rpOrder.id,
      razorpayKeyId: this.razorpayProvider.getPublicKeyId(),
    };
  }

  private async beginStripeBatchCheckout(
    batch: EnrollmentBatch,
    orders: PaymentOrder[],
    totalAmount: number,
    currency: string,
  ): Promise<Record<string, any>> {
    const frontendUrl = this.configService.get<string>('mail.frontendUrl');
    const productName = `CodeMerit Subject Enrollment Bundle — ${batch.tier} (${orders.length} subjects)`;

    const session = await this.stripeProvider.createCheckoutSession({
      amount: totalAmount,
      currency,
      productName,
      successUrl: `${frontendUrl}/payments/success?batchId=${batch.id}`,
      cancelUrl: `${frontendUrl}/payments/cancel?batchId=${batch.id}`,
      metadata: {
        batchId: String(batch.id),
        userId: String(batch.userId),
        subjectCount: String(orders.length),
      },
    });

    await this.orderRepo.update({ batchId: batch.id }, { providerOrderId: session.id });

    return {
      provider: PaymentProviderEnum.Stripe,
      stripeSessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async listMyOrders(userId: number): Promise<PaymentOrder[]> {
    return this.orderRepo.find({ where: { userId }, order: { id: 'DESC' } });
  }

  /** Client-driven counterpart to handleRazorpayWebhook() — called right after
   * Checkout.js's `handler` fires with the payment result, so a checkout can be
   * fulfilled immediately without depending on Razorpay's webhook actually being able
   * to reach this server (never true for a local/dev backend). Signature is verified
   * against RAZORPAY_KEY_SECRET (never trust the client's say-so that payment
   * succeeded); the matched order(s) must belong to the caller AND already carry this
   * exact razorpayOrderId (set at checkout-creation time) — this is what stops a caller
   * from replaying a real signature from one of their own past orders against a
   * different, unrelated order id. fulfillOrder() is already idempotent, so a webhook
   * delivery landing before or after this call (or a page refresh replaying this call)
   * is harmless either way. */
  async verifyAndFulfillCheckout(userId: number, dto: VerifyCheckoutDto): Promise<{ status: string }> {
    const valid = this.razorpayProvider.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
    if (!valid) {
      // 400, not 401 — this is an authenticated request (real JWT attached) being
      // rejected on business grounds (bad signature), not an auth failure. The
      // frontend's global ErrorInterceptor force-logs-out + reloads on ANY 401 seen on a
      // request that carried a token, regardless of *why* the backend returned it — a
      // 401 here would silently log a customer out right after they paid.
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'Payment signature could not be verified.');
    }

    const where = dto.batchId != null
      ? { batchId: dto.batchId, userId, provider: PaymentProviderEnum.Razorpay, providerOrderId: dto.razorpayOrderId }
      : { id: dto.orderId, userId, provider: PaymentProviderEnum.Razorpay, providerOrderId: dto.razorpayOrderId };
    const orders = await this.orderRepo.find({ where });
    if (!orders.length) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'No matching order found for this payment.');
    }

    await this.fulfillOrders(orders, dto.razorpayPaymentId);
    return { status: 'ok' };
  }

  async handleRazorpayWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const valid = this.razorpayProvider.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      throw new AppCustomException(HttpStatus.UNAUTHORIZED, 'Invalid Razorpay webhook signature.');
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const paymentEntity = event?.payload?.payment?.entity;

    // Only payment.captured actually fulfills anything — payment.failed, order.paid,
    // refund events etc. are acknowledged (200) but intentionally not acted on here.
    if (event?.event !== 'payment.captured' || !paymentEntity?.order_id) {
      return;
    }

    const orders = await this.orderRepo.find({
      where: { provider: PaymentProviderEnum.Razorpay, providerOrderId: paymentEntity.order_id },
    });
    if (!orders.length) {
      this.logger.warn(`Razorpay webhook for unknown order_id ${paymentEntity.order_id}`);
      return;
    }

    await this.fulfillOrders(orders, paymentEntity.id);
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    // Throws (401 via the controller) on a bad/missing signature — Stripe's SDK does
    // the verification, unlike the manual HMAC check for Razorpay above.
    const event = this.stripeProvider.constructWebhookEvent(rawBody, signature);

    if (event.type !== 'checkout.session.completed') return;

    const session = event.data.object as { id: string; payment_intent: string | null };
    const orders = await this.orderRepo.find({
      where: { provider: PaymentProviderEnum.Stripe, providerOrderId: session.id },
    });
    if (!orders.length) {
      this.logger.warn(`Stripe webhook for unknown session id ${session.id}`);
      return;
    }

    await this.fulfillOrders(orders, session.payment_intent ?? session.id);
  }

  /** Fulfills every PaymentOrder row sharing one gateway transaction — exactly one
   * row for today's ordinary single-subject checkout, N rows for a batch checkout.
   * Each row is fulfilled independently via fulfillOrder() below (same per-item
   * idempotency/conflict handling either way); if the group shares a batchId, the
   * EnrollmentBatch is updated to Completed/PartiallyCompleted/Failed once every row
   * has been attempted. Orders with no batchId (the single-subject case) skip that
   * step entirely — nothing else changes for them. */
  private async fulfillOrders(orders: PaymentOrder[], providerPaymentId: string): Promise<void> {
    // Each order touches a distinct (userId, subjectId) row and fulfillOrder() never
    // rethrows an AppCustomException (it marks the order Failed instead — see above),
    // so these are safe to run concurrently rather than one-by-one.
    await Promise.all(orders.map((order) => this.fulfillOrder(order, providerPaymentId)));

    const batchId = orders[0]?.batchId;
    if (!batchId) return;

    const succeeded = orders.filter((o) => o.status === PaymentOrderStatusEnum.Paid).length;
    const status =
      succeeded === orders.length
        ? EnrollmentBatchStatusEnum.Completed
        : succeeded > 0
          ? EnrollmentBatchStatusEnum.PartiallyCompleted
          : EnrollmentBatchStatusEnum.Failed;
    await this.skillEnrollmentService.completeBatch(batchId, status);
  }

  /** Idempotent — webhooks can and will be retried/duplicated by both gateways. Marks
   * the order Failed (rather than throwing, which would just make the gateway retry
   * forever) on ANY fulfillment error we understand — not just the "already enrolled"
   * conflict, but also e.g. a tier offering deactivated or a subject deleted between
   * checkout and webhook delivery. A payment was already captured by this point, so
   * silently leaving the order stuck in `Created` (which an uncaught throw here would
   * do, since it propagates out of the webhook handler and makes the gateway retry
   * indefinitely) is worse than recording a clear Failed state for manual review. Only
   * a truly unexpected (non-AppCustomException) error still rethrows. */
  private async fulfillOrder(order: PaymentOrder, providerPaymentId: string): Promise<void> {
    if (order.status === PaymentOrderStatusEnum.Paid) return;

    try {
      const enrollment = await this.skillEnrollmentService.fulfillPurchase({
        userId: order.userId,
        subjectId: order.subjectId,
        tier: order.tier,
        price: Number(order.amount),
        currency: order.currency,
        reference: order.providerOrderId ?? String(order.id),
        batchId: order.batchId,
      });

      order.status = PaymentOrderStatusEnum.Paid;
      order.providerPaymentId = providerPaymentId;
      order.paidAt = new Date();
      order.enrollmentId = enrollment.id;
      await this.orderRepo.save(order);

      try {
        await this.activityService.createActivity(
          order.userId,
          'Payment Successful',
          `payment successful — "${order.tier}" plan enrollment confirmed.`,
          { dataId: String(enrollment.id), dataType: 'skill_enrollment' },
        );
      } catch (activityError) {
        this.logger.error(
          `Failed to log payment-success activity for order ${order.id}: ${activityError instanceof Error ? activityError.message : String(activityError)}`,
        );
      }
    } catch (error) {
      if (error instanceof AppCustomException) {
        // A CONFLICT here almost always means the webhook and POST /apis/payments/verify
        // raced for this exact purchase — one of them already created the enrollment via
        // createEnrollment()'s per-(userId,subjectId) lock, and this call just lost that
        // race. That is NOT a real failure (the payment was captured and access was
        // granted, just via the other caller) — recording it as Failed would be wrong and
        // would hide a successful purchase behind a scary status. Attach this order to
        // whichever active enrollment now exists instead.
        if (error.status === HttpStatus.CONFLICT) {
          const existing = await this.skillEnrollmentService.getActiveEnrollment(order.userId, order.subjectId);
          if (existing) {
            order.status = PaymentOrderStatusEnum.Paid;
            order.providerPaymentId = providerPaymentId;
            order.paidAt = new Date();
            order.enrollmentId = existing.id;
            await this.orderRepo.save(order);
            return;
          }
        }

        order.status = PaymentOrderStatusEnum.Failed;
        order.failureReason = `Payment captured but enrollment could not be fulfilled: ${error.message}`;
        await this.orderRepo.save(order);
        this.logger.error(
          `Order ${order.id} paid but could not be fulfilled (${error.message}) — needs manual review.`,
        );
        return;
      }
      throw error;
    }
  }
}
