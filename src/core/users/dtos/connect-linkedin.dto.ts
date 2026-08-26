import { IsString, MinLength } from 'class-validator';

export class ConnectLinkedInDto {
  @IsString()
  @MinLength(1)
  code: string;
}
