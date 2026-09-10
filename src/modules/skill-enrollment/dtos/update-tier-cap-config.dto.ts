import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateTierCapConfigDto {
  @ApiProperty({ example: 50, description: 'Max practice questions per day for this tier (summed across all quizzes taken that day, per subject). Only enforced for Basic/Curious — Pro/Intern/Serious are always unlimited.' })
  @IsInt()
  @Min(0)
  dailyQuestionCap: number;
}
