import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateInterviewDto {
  @ApiPropertyOptional({ example: 'Technical Assessment Slot' })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @ApiPropertyOptional({ example: 101 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  jobRoleId?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
