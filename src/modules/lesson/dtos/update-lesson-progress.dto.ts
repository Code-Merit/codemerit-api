import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';

export class UpdateLessonProgressDto {
  @ApiProperty({
    enum: UserLessonTrackerStatusEnum,
    required: false,
    example: UserLessonTrackerStatusEnum.Completed,
  })
  @IsOptional()
  @IsEnum(UserLessonTrackerStatusEnum)
  status?: UserLessonTrackerStatusEnum;

  @ApiProperty({ required: false, example: 60, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;
}
