import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class GrantCertificateDto {
  @IsInt()
  userId: number;

  @IsInt()
  certificationTrackId: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
