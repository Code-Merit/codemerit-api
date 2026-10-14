import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Min,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';

export class AttemptDto {
  @ApiProperty({ example: 101 })
  @IsInt()
  questionId: number;

  // null for a skipped/timed-out question — nothing was picked.
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  selectedOption: number | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeTaken: number;

  // Display copy of the chosen option's text; '' when skipped.
  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @IsString()
  answer: string;

  // Re-derived server-side for option-based questions (recomputeAttemptCorrectness);
  // only trusted for free-text questions.
  @ApiProperty({ example: true })
  @IsBoolean()
  isCorrect: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  hintUsed: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  isSkipped: boolean;
}

export class SubmitQuizDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quizId: number;

  // Required in practice (quizId alone is ambiguous between the two tables). Optional
  // here so the service can return a clearer error than the validator would.
  @ApiPropertyOptional({ enum: QuizTypeEnum, example: QuizTypeEnum.UserQuiz })
  @IsOptional()
  @IsEnum(QuizTypeEnum)
  quizType?: QuizTypeEnum;

  // Ignored; the controller sets it from the JWT.
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  userId: number;

  // total/correct/wrong/unanswered/score are ignored; submitQuiz() recomputes them.
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  total?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  correct?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  wrong?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  unanswered?: number;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  timeSpent: number;

  @ApiProperty({ type: [AttemptDto], example: [{ questionId: 101, selectedOption: 1, answer: 'B', isCorrect: true, hintUsed: false, isSkipped: true,timeTaken:5  }] })
  @IsArray()
  @ArrayNotEmpty()
  // Sanity ceiling; submitQuiz() also drops attempts for questions not in the quiz.
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AttemptDto)
  attempts: AttemptDto[];

  @ApiPropertyOptional({ example: 'Mobile' })
  @IsOptional()
  @IsString()
  device?: string;

  @ApiPropertyOptional({ example: 'Windows 10/11 / Chrome 128' })
  @IsOptional()
  @IsString()
  client?: string;

  @ApiPropertyOptional({ example: '203.0.113.42' })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}
