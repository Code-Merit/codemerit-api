import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class LinkedinShareDto {
  @IsString()
  @MaxLength(3000)
  text: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  // Optional remote image URL (existing behaviour)
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  // Optional base64 data URL payload (data:image/png;base64,....)
  @IsOptional()
  @IsString()
  imageDataUrl?: string;

  // Optional filename to suggest when persisting/uploading the image
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageFileName?: string;
}
