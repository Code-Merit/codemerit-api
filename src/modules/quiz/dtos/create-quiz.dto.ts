import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNumber,
  IsNotEmpty,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';
import { TopicLabelEnum } from 'src/common/enum/topic-label.enum';
import { QuizSettingsDto } from './quiz-settings.dto';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';

export class CreateQuizDto {
  @ApiProperty()
  @IsNumber()
  userId: number;

  @ApiPropertyOptional({
    description: 'Title of the topic',
    example: 'Forms in Angular',
  })
  @ValidateIf((o) => o.quizType === QuizTypeEnum.Standard)
  @IsString()
  @IsNotEmpty({ message: 'Title is required ' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Short description of the quiz',
    example: 'Short description of the quiz',
  })
  @ValidateIf((o) => o.quizType === QuizTypeEnum.Standard)
  @IsString()
  @IsNotEmpty({ message: 'Short description is required ' })
  shortDesc?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the quiz',
    example: 'Detailed description of the quiz',
  })
  @ValidateIf((o) => o.quizType === QuizTypeEnum.Standard)
  @IsString()
  @IsNotEmpty({ message: 'Description is required ' })
  description: string;

  @ApiPropertyOptional({ example: '1, 2' })
  @ValidateIf((o) => !o.topicIds && !o.subjectTrackIds)
  @IsString()
  @IsNotEmpty({ message: 'At least one of subjectIds, topicIds, or subjectTrackIds is required' })
  subjectIds?: string;

  @ApiPropertyOptional({ example: '100, 200' })
  @ValidateIf((o) => !o.subjectIds && !o.subjectTrackIds)
  @IsString()
  @IsNotEmpty({ message: 'At least one of subjectIds, topicIds, or subjectTrackIds is required' })
  topicIds?: string;

  @ApiPropertyOptional({
    example: '5, 6',
    description: 'SubjectTrack IDs — resolved server-side to their member topics',
  })
  @ValidateIf((o) => !o.subjectIds && !o.topicIds)
  @IsString()
  @IsNotEmpty({ message: 'At least one of subjectIds, topicIds, or subjectTrackIds is required' })
  subjectTrackIds?: string;

  @ApiProperty({
    enum: QuizTypeEnum,
    example: QuizTypeEnum.UserQuiz,
    description: 'Type of quiz',
  })
  @IsEnum(QuizTypeEnum)
  quizType: QuizTypeEnum; // user will create as UserQuiz

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  numQuestions?: number;

  @ApiPropertyOptional({
    enum: TopicLabelEnum,
    example: TopicLabelEnum.Foundation,
  })
  @IsOptional()
  @IsEnum(TopicLabelEnum)
  label?: TopicLabelEnum;

  @ApiPropertyOptional({
    type: [Number],
    example: [2, 4, 5, 6, 7, 8],
    description: 'Mandatory only for Standard quiz type',
  })
  @ValidateIf((o) => o.quizType === QuizTypeEnum.Standard)
  @IsDefined({ message: 'questionIds is required' })
  @IsArray({ message: 'questionIds must be an array of numbers' })
  @ArrayNotEmpty({
    message: 'questionIds must be a non-empty array',
  })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: 'questionIds must contain only integer numbers',
  })
  questionIds?: number[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 'Achieve 80% accuracy' })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional({ example: 'angular,forms' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ example: 'Default', default: 'Default' })
  @IsOptional()
  @IsString()
  category?: string = 'Default';

  @ApiPropertyOptional({
    enum: DifficultyLevelEnum,
    example: DifficultyLevelEnum.Easy,
    description: 'Level of the quiz',
  })
  @IsOptional()
  @IsEnum(DifficultyLevelEnum)
  level?: DifficultyLevelEnum;

  @ApiPropertyOptional({
    description: 'Quiz settings (only for Standard quiz)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuizSettingsDto)
  settings?: QuizSettingsDto;
}
