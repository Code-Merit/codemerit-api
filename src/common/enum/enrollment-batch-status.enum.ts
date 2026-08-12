// Lifecycle of one multi-subject enrollment action (EnrollmentBatch). Free/admin
// batches are synchronous and go straight to Completed (or aren't created at all if
// zero subjects end up eligible) — only a paid batch passes through Pending while
// waiting on a gateway webhook, and can land on PartiallyCompleted if an individual
// item conflicts at fulfillment time while its siblings succeed.
export enum EnrollmentBatchStatusEnum {
  Pending = 'pending',
  Completed = 'completed',
  PartiallyCompleted = 'partially_completed',
  Failed = 'failed',
}
