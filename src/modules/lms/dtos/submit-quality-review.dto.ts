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

  // Required in practice, but validated in the service rather than here — the rule depends
  // on `outcome`/`tagIds` together: Approve always needs an explicit grade, while
  // Reject/NeedsRevision can instead derive one from the worst-severity issue tag selected
  // (see QuestionQualityService.submitReview). A cross-field business rule like that belongs
  // in the service, not a shape-only DTO check.
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
