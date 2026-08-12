import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class EnrollBasicDto {
  @ApiProperty({ example: 3, description: 'Subject to enroll in at the free Basic tier.' })
  @IsInt()
  subjectId: number;
}
