import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class AssignInterviewDto {
  @ApiProperty({ example: 42, description: 'User id of the SME/interviewer to assign' })
  @IsInt()
  @IsPositive()
  interviewerId: number;

  @ApiProperty({
    example: '2026-12-31T15:00:00.000Z',
    description: "This round's own scheduled date/time (each round is scheduled independently).",
  })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({
    example: 60,
    default: 60,
    description:
      "How long this round is booked for, in minutes. Used to detect overlaps against the " +
      "SME's and candidate's other rounds — defaults to 60 if omitted.",
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'Assigning based on Node.js expertise' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  remarks?: string;
}
