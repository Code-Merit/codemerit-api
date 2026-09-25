import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Backs PUT apis/users/basic-info — self-serve edit of designation/city/country (User) and
// about/linkedinUrl (Profile) in a single partial-patch call.
export class UpdateBasicInfoDto {
  @ApiPropertyOptional({ example: 'Frontend Developer', description: 'Free-text headline shown under the name in the profile header.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  designation?: string;

  @ApiPropertyOptional({ example: 'A brief about the user' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  about?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/username' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;
}
