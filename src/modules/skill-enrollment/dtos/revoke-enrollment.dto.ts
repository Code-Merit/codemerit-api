import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RevokeEnrollmentDto {
  @ApiPropertyOptional({ example: 'Refund issued.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
