import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CancelInterviewDto {
  @ApiProperty({ example: 'Role has been put on hold by hiring team.' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 1000)
  declineReason: string;
}
