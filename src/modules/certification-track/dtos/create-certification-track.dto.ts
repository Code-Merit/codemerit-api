import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
