import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, ValidateIf } from 'class-validator';

// Exactly one of orderId/batchId identifies which PaymentOrder row(s) this callback is
// for — mirrors createCheckout()/createBatchCheckout()'s own split, since a batch shares
// one Razorpay order across several PaymentOrder rows.
export class VerifyCheckoutDto {
  @ApiProperty({ required: false, example: 42, description: 'Set for a single-subject checkout (from the checkout response).' })
  @ValidateIf((o) => o.batchId == null)
  @IsInt()
  @Min(1)
  orderId?: number;

  @ApiProperty({ required: false, example: 7, description: 'Set for a job-role/batch checkout (from the batch checkout response).' })
  @ValidateIf((o) => o.orderId == null)
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiProperty({ example: 'order_abc123', description: 'razorpay_order_id returned by Checkout.js on success.' })
  @IsString()
  razorpayOrderId: string;

  @ApiProperty({ example: 'pay_xyz789', description: 'razorpay_payment_id returned by Checkout.js on success.' })
  @IsString()
  razorpayPaymentId: string;

  @ApiProperty({ example: 'signature-hex', description: 'razorpay_signature returned by Checkout.js on success.' })
  @IsString()
  razorpaySignature: string;
}
