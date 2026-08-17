import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, Min } from 'class-validator';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

export class CreateCheckoutDto {
  @ApiProperty({ example: 12, description: 'Subject to purchase an enrollment for.' })
  @IsInt()
  @Min(1)
  subjectId: number;

  @ApiProperty({
    enum: EnrollmentTierEnum,
    example: EnrollmentTierEnum.Curious,
    description: 'Curious/Pro/Intern/Serious only — the subject must have an active SkillTierOffering for it. Basic is free and never goes through checkout (use enroll-basic).',
  })
  @IsEnum(EnrollmentTierEnum)
  tier: EnrollmentTierEnum;

  @ApiProperty({ example: 'INR', enum: ['INR', 'USD'], description: 'Determines both price and gateway (INR -> Razorpay, USD -> Stripe).' })
  @IsIn(['INR', 'USD'])
  currency: 'INR' | 'USD';
}
