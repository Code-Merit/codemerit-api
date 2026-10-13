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

  // Display copy of the chosen option's text; '' when skipped. Clamped to the column
  // width in submitQuiz() rather than rejected here.
  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
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

  // Ignored — the controller always overwrites this with the JWT's user id. Optional
  // only so existing clients that still send it keep validating.
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  userId: number;

  // total/correct/wrong/unanswered/score are ignored — submitQuiz() recomputes all of
  // them server-side from `attempts`. Optional so clients can stop sending them.
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
  // Sanity ceiling only (Standard quizzes aren't bound by MAX_QUIZ_LENGTH) — the real
  // check is submitQuiz() dropping attempts for questions not in this quiz.
  @ArrayMaxSize(200)
  // Without this, none of AttemptDto's own validators ever ran — any shape was accepted.
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
