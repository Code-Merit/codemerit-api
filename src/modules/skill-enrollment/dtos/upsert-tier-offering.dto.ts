import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

export class UpsertTierOfferingDto {
  @ApiProperty({ example: 3, description: 'Subject this offering applies to.' })
  @IsInt()
  @Min(1)
  subjectId: number;

  @ApiProperty({
    enum: EnrollmentTierEnum,
    example: EnrollmentTierEnum.Curious,
    description: 'Basic is implicit and cannot be declared here.',
  })
  @IsEnum(EnrollmentTierEnum)
  tier: EnrollmentTierEnum;

  @ApiPropertyOptional({ example: 299, description: 'Override price in INR. Omit to use the tier default.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceInr?: number;

  @ApiPropertyOptional({ example: 8, description: 'Override price in USD. Omit to use the tier default.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsd?: number;

  @ApiPropertyOptional({ example: 1, description: 'Override access-window length in months. Omit to use the tier default.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMonths?: number;
}
