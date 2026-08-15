import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

export class BatchUpsertTierOfferingsDto {
  @ApiProperty({
    example: [3, 7, 12],
    description: 'Subjects to declare the tiers below for, in one action.',
  })
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  subjectIds: number[];

  @ApiProperty({
    enum: EnrollmentTierEnum,
    isArray: true,
    example: [EnrollmentTierEnum.Curious, EnrollmentTierEnum.Pro],
    description:
      'Tiers to offer on every subject above (the full cross-product). Basic is ' +
      "skipped if included — it's universal and can't be declared as an offering.",
  })
  @IsEnum(EnrollmentTierEnum, { each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  tiers: EnrollmentTierEnum[];

  @ApiPropertyOptional({
    example: 299,
    description:
      'Same price/duration override applied to every (subject, tier) pair in this ' +
      "batch. Omit to use each tier's default. For a different override per pair, " +
      'use the single-item endpoint instead.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceInr?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsd?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number;
}
