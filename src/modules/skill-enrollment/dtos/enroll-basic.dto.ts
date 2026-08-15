import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class EnrollBasicDto {
  @ApiProperty({ example: 3, description: 'Subject to enroll in at the free Basic tier.' })
  @IsInt()
  @Min(1)
  subjectId: number;
}
