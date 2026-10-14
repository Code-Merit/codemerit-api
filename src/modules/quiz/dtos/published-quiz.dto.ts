import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ModeEnum } from 'src/common/enum/quiz-settings.enum';

/** All filters optional; 0 means "no filter". */
export class PublishedQuizFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  subjectId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  topicId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  jobRoleId?: number;

  @ApiPropertyOptional({ enum: ModeEnum })
  @IsOptional()
  @IsEnum(ModeEnum)
  mode?: ModeEnum;
}
