import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCertificationTrackDto {
  @ApiPropertyOptional({ example: 'Frontend Fundamentals Updated' })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  @IsString()
  @IsOptional()
  description?: string;
}
