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

  @ApiProperty({
    required: false,
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'How useful the lesson was, 1-5. Can be sent on any progress update, whether or not this call completes the lesson.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  useful?: number;

  @ApiProperty({
    required: false,
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Perceived quality of the lesson, 1-5. Can be sent on any progress update, whether or not this call completes the lesson.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  quality?: number;
}
