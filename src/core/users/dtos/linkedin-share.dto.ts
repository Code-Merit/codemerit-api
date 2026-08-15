import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class LinkedinShareDto {
  @IsString()
  @MaxLength(3000)
  text: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
