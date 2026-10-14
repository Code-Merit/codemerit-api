import { InviteTypeEnum } from 'src/common/enum/invite-type.enum';

/** "invited … to ___" phrase per invite type. Mirrors the frontend's inviteWhatForPhrase
 * (codemerit: src/app/shared/utils/invite-phrase.util.ts) so activity logs describe an
 * invite the same way the invite UI does — keep the two in sync by hand. */
export function invitePurposePhrase(
  type: InviteTypeEnum,
  targetLabel: string | null | undefined,
): string {
  const label = targetLabel || null;
  switch (type) {
    case InviteTypeEnum.JOURNEY:
      return label ? `explore ${label}` : 'explore a new skill';
    case InviteTypeEnum.CERTIFICATION:
      return label ? `earn the ${label} certificate` : 'earn a certificate';
    case InviteTypeEnum.BADGE:
      return label ? `earn the ${label} badge` : 'earn a badge';
    case InviteTypeEnum.MOCK_INTERVIEW:
      return label ? `prep for a ${label} interview` : 'practice for an interview';
    case InviteTypeEnum.QUESTION_REVIEW:
      return label ? `help review ${label} questions` : 'help review questions';
    case InviteTypeEnum.GENERIC:
    default:
      return 'join CodeMerit';
  }
}
