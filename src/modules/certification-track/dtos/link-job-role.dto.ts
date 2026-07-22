import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class LinkJobRoleDto {
  @ApiProperty({ description: 'Job Role ID to associate with this certification track', example: 1 })
  @IsInt()
  jobRoleId: number;

  @ApiPropertyOptional({ description: 'Display order of this certification within the job role track', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether this certification is published for this job role', example: true })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Role-tailored description overriding the certification default description' })
  @IsString()
  @IsOptional()
  descriptionOverride?: string;
}
