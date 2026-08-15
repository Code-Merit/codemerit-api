// All three are real, reachable sources: AdminGrant via SkillEnrollmentService
// .grantEnrollment(), Purchase via a fulfilled payment webhook (fulfillPurchase(),
// PaymentService), and Promo via the self-serve enrollBasic()/enrollBasicBatch()
// free-Basic path.
export enum EnrollmentSourceEnum {
  AdminGrant = 'admin_grant',
  Purchase = 'purchase',
  Promo = 'promo',
}
