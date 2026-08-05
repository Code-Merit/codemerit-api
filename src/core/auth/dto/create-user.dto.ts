import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEmpty,
  IsMobilePhone,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'First name of the user',
    example: 'Ralph',
  })
  @IsNotEmpty({ message: 'First name must not be empty' })
  firstName: string;

  @ApiProperty({
    description: 'Last name of the user',
    example: 'Tolle',
  })
  lastName?: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'ralph@appdev.com',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email must not be empty' })
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  // @Matches(/^[0-9]{10}$/, {
  //   message: 'Mobile must be a 10-digit number',
  // })
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dreamRole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  techRoleId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  jobRoleId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  yearsExperience?: number;

  @ApiPropertyOptional()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  about: string;

  @ApiPropertyOptional()
  @IsOptional()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  linkedinId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  googleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional()
  @IsOptional()
  auth_provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  flow?: string;

  @ApiPropertyOptional({
    description: 'Marketing/attribution source supplied by the client at signup (e.g. a UTM value or "how did you hear about us" answer).',
  })
  @IsOptional()
  referrerSource?: string;
}
