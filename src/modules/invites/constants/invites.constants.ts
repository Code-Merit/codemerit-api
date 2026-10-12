// Human-typeable on the referral-code page — not a UUID. Base36 upper-cased, generated
// from crypto.randomBytes in InvitesService.generateCode().
export const INVITE_CODE_LENGTH = 8;

export const INVITE_EXPIRY_DAYS = 30;

// DI token for the InviteTypeEnum -> InviteActionHandler map — see invite-action.handler.ts.
export const INVITE_ACTION_HANDLERS = 'INVITE_ACTION_HANDLERS';
