import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateTierCapConfigDto {
  @ApiProperty({ example: 4, description: 'Max quizzes per day for this tier. Only enforced for Basic/Curious — Pro/Intern/Serious are always unlimited.' })
  @IsInt()
  @Min(0)
  dailyQuizCap: number;

  @ApiProperty({ example: 3, description: 'Max lessons per day for this tier. Only enforced for Basic/Curious — Pro/Intern/Serious are always unlimited.' })
  @IsInt()
  @Min(0)
  dailyLessonCap: number;
}
