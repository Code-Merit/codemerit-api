import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class GetQuestionsByIdsDto {
  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3],
    description: 'Array of subject IDs',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  subjectIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [10, 20, 30],
    description: 'Array of topic IDs',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  topicIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2],
    description: 'Array of SubjectTrack IDs — resolved to their member topics for selection',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  subjectTrackIds?: number[];

  @IsOptional()
  @IsNumber()
  numQuestions?:number = 10;

  //delete if unused
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  questionIds?: number[];
}
