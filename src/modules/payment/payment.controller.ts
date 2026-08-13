import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { ApiResponse } from 'src/common/utils/api-response';
import { CreateCheckoutDto } from './dtos/create-checkout.dto';
import { CreateBatchCheckoutDto } from './dtos/create-batch-checkout.dto';
import { PaymentService } from './providers/payment.service';

@ApiTags('Payments')
@Controller('apis/payments')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @ApiOperation({
    summary: 'Current enrollment pricing (public)',
    description:
      'Every paid tier x currency combination, plus which gateway each currency routes ' +
      'to. Reflects FOUNDER_PRICING_ENABLED — this is exactly what /checkout will charge, ' +
      'so a pricing page never has to hardcode amounts.',
  })
  @Public()
  @Get('pricing')
  pricing(): ApiResponse<any> {
    const result = this.service.getPricingCatalog();
    return new ApiResponse('Pricing fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Start a checkout for a Subject/JobRole enrollment',
    description:
      'Price is looked up server-side from the pricing catalog (currency determines both ' +
      'amount and gateway: INR -> Razorpay, USD -> Stripe) — never trust a client-submitted ' +
      'amount. Returns whatever the caller\'s frontend needs to launch that gateway\'s ' +
      'checkout (Razorpay order id + key id for Checkout.js, or a Stripe-hosted checkout URL). ' +
      '409 if the caller already has an active enrollment for this scope.',
  })
  @ApiResponseDoc({ status: 404, description: 'No subject exists with the given id.' })
  @ApiResponseDoc({ status: 400, description: 'The subject does not offer the given tier, or the tier is Basic (not purchasable).' })
  @ApiResponseDoc({ status: 409, description: 'Caller already has an active enrollment for this subject.' })
  @ApiResponseDoc({ status: 503, description: 'The gateway for the requested currency is not configured on this environment.' })
  @ApiBearerAuth('access-token')
  @Post('checkout')
  async checkout(
    @Body() dto: CreateCheckoutDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.createCheckout(req.user.id, dto);
    return new ApiResponse('Checkout created successfully.', result);
  }

  @ApiOperation({
    summary: 'Start a checkout for several subjects at one plan, in one payment',
    description:
      'The same field whether you\'re checking out "all of a job role\'s subjects" ' +
      'or a hand-picked subset — just send that subject-id list. Price is looked up ' +
      'server-side per subject and summed — never trust a client-submitted amount. ' +
      'Skip-and-proceed: a subject that\'s already enrolled, doesn\'t exist, or ' +
      'doesn\'t offer this tier is dropped from the batch rather than failing the ' +
      'whole request — `skipped` always lists what and why, and `totalAmount` only ' +
      'reflects what\'s actually being charged. `eligibleSubjectIds` empty (and ' +
      '`batchId: null`) means nothing was eligible — no gateway call was made, ' +
      'nothing to pay for. 503 if the gateway isn\'t configured yet.',
  })
  @ApiResponseDoc({ status: 400, description: 'The tier given is Basic — not purchasable, use POST /apis/enrollments/enroll-basic/batch instead.' })
  @ApiResponseDoc({ status: 503, description: 'The gateway for the requested currency is not configured on this environment.' })
  @ApiBearerAuth('access-token')
  @Post('checkout/batch')
  async checkoutBatch(
    @Body() dto: CreateBatchCheckoutDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.createBatchCheckout(req.user.id, dto);
    return new ApiResponse('Batch checkout processed successfully.', result);
  }

  @ApiOperation({ summary: "List the caller's own payment orders" })
  @ApiBearerAuth('access-token')
  @Get('orders/me')
  async myOrders(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.service.listMyOrders(req.user.id);
    return new ApiResponse('Your orders fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Razorpay webhook (not for direct use — configure this URL in the Razorpay dashboard)',
    description:
      'Verifies the X-Razorpay-Signature header via HMAC before acting on anything. Only ' +
      'payment.captured fulfills an enrollment; other event types are acknowledged and ignored. ' +
      'Idempotent — safe for Razorpay to retry/duplicate deliveries.',
  })
  @ApiHeader({ name: 'x-razorpay-signature', description: 'HMAC signature of the raw request body, from Razorpay.' })
  @ApiResponseDoc({ status: 401, description: 'Signature missing or does not match the raw request body.' })
  @Public()
  @Post('webhook/razorpay')
  async razorpayWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ status: string }> {
    await this.service.handleRazorpayWebhook(req.rawBody, signature);
    return { status: 'ok' };
  }

  @ApiOperation({
    summary: 'Stripe webhook (not for direct use — configure this URL in the Stripe dashboard)',
    description:
      'Verifies the Stripe-Signature header via the Stripe SDK before acting on anything. ' +
      'Only checkout.session.completed fulfills an enrollment. Idempotent — safe for ' +
      'Stripe to retry/duplicate deliveries.',
  })
  @ApiHeader({ name: 'stripe-signature', description: 'Signature of the raw request body, from Stripe.' })
  @ApiResponseDoc({ status: 401, description: 'Signature missing or does not match the raw request body.' })
  @Public()
  @Post('webhook/stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ status: string }> {
    await this.service.handleStripeWebhook(req.rawBody, signature);
    return { status: 'ok' };
  }
}
