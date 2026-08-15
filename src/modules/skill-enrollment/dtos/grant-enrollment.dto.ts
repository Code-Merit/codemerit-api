import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

export class GrantEnrollmentDto {
  @ApiProperty({ example: 101, description: 'User to enroll' })
  @IsInt()
  @Min(1)
  userId: number;

  @ApiProperty({ example: 12, description: 'Subject to enroll the user in.' })
  @IsInt()
  @Min(1)
  subjectId: number;

  @ApiProperty({
    enum: EnrollmentTierEnum,
    example: EnrollmentTierEnum.Curious,
    description: 'Any tier, including Basic (though users normally self-serve that via enroll-basic). Curious/Pro/Intern/Serious require the subject to have an active SkillTierOffering for it.',
  })
  @IsEnum(EnrollmentTierEnum)
  tier: EnrollmentTierEnum;

  @ApiPropertyOptional({ example: 6, description: 'Access window length in months. Defaults per-tier (Basic never expires regardless of this field).' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  months?: number;

  @ApiPropertyOptional({ example: 699, description: 'Amount actually paid/recorded for this grant, if any.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'ORDER-4471', description: 'Free-form reference (order id, promo code, etc).' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'Manual grant — cash payment collected at workshop.' })
  @IsOptional()
  @IsString()
  note?: string;
}
