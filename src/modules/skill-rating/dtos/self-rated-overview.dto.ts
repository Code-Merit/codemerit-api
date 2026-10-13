export class SelfRatedMetricDto {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  maxScore: number;
  currentRating: number | null;
  ratedAt: Date | null;
}

export type SelfRatedSubjectSource = 'topic' | 'subject' | 'none';

export class SelfRatedSubjectDto {
  subjectId: number;
  title: string;
  slug: string;
  image: string | null;
  totalTopics: number;
  ratedTopics: number;
  averageRating: number | null;
  lastRatedAt: Date | null;
  source: SelfRatedSubjectSource;
}

export class SkillSelfRatingOverviewDto {
  metrics: SelfRatedMetricDto[];
  subjects: SelfRatedSubjectDto[];
}
