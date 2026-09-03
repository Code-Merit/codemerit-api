export enum QualityResourceTypeEnum {
  Question = 'Question',
  // Reserved — QualityReview.resourceType/resourceId already support this value, but no
  // Lesson-scoped QualityMetric rows are seeded and no controller route submits Lesson
  // reviews yet. Wire up once Lesson-specific issue tags are drafted.
  Lesson = 'Lesson',
}
