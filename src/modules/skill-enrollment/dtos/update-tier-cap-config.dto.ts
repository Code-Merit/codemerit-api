import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateTierCapConfigDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(0)
  dailyQuizCap: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  dailyLessonCap: number;
}
