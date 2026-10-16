import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

// Backs PUT apis/users/avatar — the caller's own profile picture as a base64 data URL. The client
// crops/resizes to a small square first; ~1.4 MB of base64 (~1 MB decoded) is a generous ceiling.
export class UpdateAvatarDto {
  @ApiProperty({ example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...' })
  @IsString()
  @MaxLength(1_400_000, { message: 'Image must be smaller than 1 MB.' })
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: 'imageDataUrl must be a base64 PNG, JPEG or WebP data URL.',
  })
  imageDataUrl: string;
}
