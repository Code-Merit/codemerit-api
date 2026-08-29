import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCertificationTrackDto {
  @ApiProperty({ description: 'Title of the certification track', example: 'JavaScript Programmer' })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Default description of what this certification represents', example: 'You write clean, well-structured JavaScript and understand why the code behaves the way it does.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Set this to make the track native to a single subject (composed only from that ' +
      "subject's own subject tracks) instead of the job-role-bundle model. Omit for a " +
      'job-role-bundle track, same as today.',
    example: 12,
  })
  @IsInt()
  @IsOptional()
  subjectId?: number;

  @ApiPropertyOptional({
    description:
      'Overrides the global pass bar (% of linked subject tracks completed) for this track ' +
      'only. Omit to use the platform-wide default.',
    example: 80,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  passThreshold?: number;

  @ApiPropertyOptional({
    description:
      'Publish gate for a subject-native track (subjectId set) — a job-role-bundle track ' +
      'is still gated per-role via the job-role link. Defaults to true.',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
