import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: 12 })
  @IsInt()
  @IsOptional()
  subjectId?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  passThreshold?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
