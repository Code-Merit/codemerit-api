import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { QualityReviewOutcomeEnum } from 'src/common/enum/quality-review-outcome.enum';

export class SubmitQualityReviewDto {
  @IsEnum(QualityReviewOutcomeEnum)
  outcome: QualityReviewOutcomeEnum;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  grade?: number | null;

  @IsOptional()
  @IsString()
  comment?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  tagIds?: number[];
}
