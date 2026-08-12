import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsEnum, IsIn, IsInt, IsOptional } from 'class-validator';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

export class CreateBatchCheckoutDto {
  @ApiProperty({
    example: [3, 5, 24],
    description:
      'Subjects to check out together in one payment, at one plan. The same field ' +
      'whether this is "all of a job role\'s subjects" or a hand-picked subset.',
  })
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  subjectIds: number[];

  @ApiProperty({
    enum: EnrollmentTierEnum,
    example: EnrollmentTierEnum.Curious,
    description: 'One plan for the whole batch — Curious/Pro/Intern/Serious only, same as single-subject checkout.',
  })
  @IsEnum(EnrollmentTierEnum)
  tier: EnrollmentTierEnum;

  @ApiProperty({ example: 'INR', enum: ['INR', 'USD'], description: 'Determines both price and gateway (INR -> Razorpay, USD -> Stripe).' })
  @IsIn(['INR', 'USD'])
  currency: 'INR' | 'USD';

  @ApiPropertyOptional({
    example: 2,
    description: 'Which job role this selection was made from, if any — opaque provenance only.',
  })
  @IsOptional()
  @IsInt()
  jobRoleId?: number;
}
