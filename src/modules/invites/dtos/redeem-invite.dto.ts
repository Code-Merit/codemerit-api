import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RedeemInviteDto {
  // Omitted entirely = Skip on the referral-code page: still stamps
  // Profile.inviteCodePromptedAt so the page never shows again, just redeems nothing.
  @ApiPropertyOptional({ description: 'Invite code. Omit to skip — the prompt is still marked seen.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;
}
