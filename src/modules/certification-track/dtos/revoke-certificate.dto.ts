import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeCertificateDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
