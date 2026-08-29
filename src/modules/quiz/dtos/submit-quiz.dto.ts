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
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';

export class AttemptDto {
  @ApiProperty({ example: 101 })
  @IsInt()
  questionId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  selectedOption: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  timeTaken: number;

  @ApiProperty({ example: 'B' })
  @IsString()
  answer: string;

  // Advisory only for gradable (option-based) questions — the server re-derives the
  // real value from QuestionOption.correct in quiz.service.ts#recomputeAttemptCorrectness
  // rather than trusting this field, so a client-side scoring bug can never permanently
  // misfile a question as wrong. Still authoritative for free-text questions with no
  // QuestionOption rows, since the server has no ground truth to check those against.
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

  // Required in practice: quizId alone is ambiguous (it could be a `quiz.id` or a
  // `user_quiz.id` in two independent id spaces) since the Standard/UserQuiz split —
  // resolveQuizAnchor() rejects a submission that omits this. Kept @IsOptional() here
  // at the DTO/validator level only so a request missing it still reaches the service
  // and gets that clearer domain-specific error, instead of a generic validator 400.
  @ApiPropertyOptional({ enum: QuizTypeEnum, example: QuizTypeEnum.UserQuiz })
  @IsOptional()
  @IsEnum(QuizTypeEnum)
  quizType?: QuizTypeEnum;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  userId: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(0)
  total: number;

  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(0)
  correct: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  wrong: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  unanswered: number;

  @ApiProperty({ example: 75 })
  @IsNumber()
  score: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  timeSpent: number;

  @ApiProperty({ type: [AttemptDto], example: [{ questionId: 101, selectedOption: 1, answer: 'B', isCorrect: true, hintUsed: false, isSkipped: true,timeTaken:5  }] })
  @IsArray()
  @ArrayNotEmpty()
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
