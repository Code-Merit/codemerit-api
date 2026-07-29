import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsEmail,
  IsPositive,
  Length,
  IsNotEmpty,
  Matches,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateInterviewDto {
  @ApiProperty({ example: 'Technical Assessment Slot' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @ApiProperty({ example: 101 })
  @IsInt()
  @IsPositive()
  jobRoleId: number;

  @ApiProperty({ example: '2026-12-31T23:59:59.999Z' })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ example: 5001 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  userId?: number;

  // Anonymous Candidate Registration Fields

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName?: string;

  @ApiPropertyOptional({ example: 'candidate@domain.com' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiPropertyOptional({ example: '9000000001' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10,15}$/)
  mobile?: string;

  @ApiPropertyOptional({ example: 3, description: "Candidate's years of experience — stored on their Profile." })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsExperience?: number;
}
