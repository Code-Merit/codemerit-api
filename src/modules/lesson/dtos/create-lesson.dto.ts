import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';

export class LessonSectionDto {
  @ApiProperty({ example: 'The Button That Broke the Dashboard' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example:
      '<p><strong>Maya:</strong> This makes no sense — my button calls a method on my own object.</p>',
    description:
      'Rich text HTML for this section. Sanitized server-side against a fixed ' +
      'tag/class allowlist before storage — no inline styles or scripts survive. ' +
      'See src/database/README.md for the allowed tags/classes, including the ' +
      'dialogue convention for comic/narrative-style lessons.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateLessonDto {
  @ApiProperty({ example: 'Why `this` Is Never What You Think' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'A dashboard bug walks through why a method loses its `this` when passed as a callback.',
    description: 'Short description shown in lesson lists/cards — distinct from the section content.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  summary: string;

  @ApiProperty({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  subject?: number;

  @ApiProperty({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  subjectId?: number;

  @ApiProperty({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  topic?: number;

  @ApiProperty({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  topicId?: number;

  @ApiProperty({
    enum: DifficultyLevelEnum,
    example: DifficultyLevelEnum.Easy,
  })
  @IsEnum(DifficultyLevelEnum)
  level: DifficultyLevelEnum;

  @ApiProperty({
    enum: ['comic', 'tutorial', 'reference'],
    default: 'tutorial',
    required: false,
    description:
      'Content/pricing category. `comic` lessons are always free regardless of subject — see ' +
      'evaluateLessonAccess() in lesson.service.ts. Defaults to "tutorial" if omitted.',
  })
  @IsOptional()
  @IsIn(['comic', 'tutorial', 'reference'])
  format?: 'comic' | 'tutorial' | 'reference';

  @ApiProperty({
    type: [LessonSectionDto],
    example: [
      {
        title: 'The Button That Broke the Dashboard',
        content:
          '<p><strong>Maya:</strong> This makes no sense — my button calls a method on my own object.</p>',
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LessonSectionDto)
  sections: LessonSectionDto[];
}
