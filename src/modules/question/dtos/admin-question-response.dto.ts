import { QuestionTopicResponseDto } from './question-topic-response.dto';

export class LatestQualityReviewResponseDto {
  grade: number | null;
  outcome: string | null;
  comment: string | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
  tags: { id: number; code: string; label: string; severity: string | null; polarity: string }[];
}

export class AdminQuestionResponseDto {
  id: number;
  question: string;
  subjectId: number;
  subject: string;
  topics: QuestionTopicResponseDto[];
  status: string;
  level: string;
  slug: string;
  questionType: string;
  createdByUsername: string;
  createdByName: string;
  // Only populated when fullData=true — the most recently touched quality_review row for
  // this question (comment/grade/tags), across all reviewers. Null if never reviewed.
  latestReview?: LatestQualityReviewResponseDto | null;
}
