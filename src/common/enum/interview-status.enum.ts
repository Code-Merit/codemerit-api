export enum InterviewStatusEnum {
  SCHEDULED = 'SCHEDULED',
  // Legacy single-round values — no longer written by current code (rounds now
  // carry their own AssessmentSessionStatusEnum), kept so old history rows and
  // any pre-migration data remain valid.
  ASSIGNED = 'ASSIGNED',
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
}