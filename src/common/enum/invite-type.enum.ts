// What accepting this invite actually does — see InviteActionHandler implementations in
// src/modules/invites/providers/invite-action.handler.ts, one per value, registered by a
// factory provider keyed on this enum. Adding a new invite scenario is one new handler +
// one new value here; InvitesService itself never branches on type.
export enum InviteTypeEnum {
  // No target — just "join CodeMerit." Complete the moment the account is active.
  GENERIC = 'Generic',
  // "Explore a skill" — enrolls the recipient in targetId (a Subject). Complete the
  // moment enrollment succeeds.
  JOURNEY = 'Journey',
  // Enrolls in the certificate's subject, but completion (the certificate actually being
  // issued) happens later, outside this module — see the deferred hook noted in the plan.
  CERTIFICATION = 'Certification',
  BADGE = 'Badge',
  MOCK_INTERVIEW = 'MockInterview',
  QUESTION_REVIEW = 'QuestionReview',
}
