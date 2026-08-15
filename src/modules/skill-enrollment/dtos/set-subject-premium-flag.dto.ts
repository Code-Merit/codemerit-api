import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetSubjectPremiumFlagDto {
  @ApiProperty({ example: false, description: 'false makes the subject a fully open showcase — unlimited lessons/quizzes for everyone, any tier.' })
  @IsBoolean()
  isPremium: boolean;
}
