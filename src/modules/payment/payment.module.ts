import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrder } from 'src/common/typeorm/entities/payment-order.entity';
import { SkillEnrollmentModule } from '../skill-enrollment/skill-enrollment.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './providers/payment.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentOrder]), SkillEnrollmentModule],
  providers: [PaymentService, RazorpayProvider, StripeProvider],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
