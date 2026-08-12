import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsEnum, IsInt } from 'class-validator';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

export class BatchDeactivateTierOfferingsDto {
  @ApiProperty({
    example: [3, 7, 12],
    description: 'Subjects to deactivate the tiers below on, in one action.',
  })
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  subjectIds: number[];

  @ApiProperty({
    enum: EnrollmentTierEnum,
    isArray: true,
    example: [EnrollmentTierEnum.Intern, EnrollmentTierEnum.Serious],
    description: 'Tiers to deactivate on every subject above (the full cross-product).',
  })
  @IsEnum(EnrollmentTierEnum, { each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  tiers: EnrollmentTierEnum[];
}
