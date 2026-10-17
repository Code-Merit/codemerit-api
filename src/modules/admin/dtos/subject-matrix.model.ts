export type SubjectVerdict = 'strong' | 'mixed' | 'weak' | 'empty';

/** Each verdict criterion's points, so the UI can explain a score instead of just showing it. */
export interface SubjectVerdictBreakdown {
  depth: number;      // 0–2: median Active Trivia per topic (>= 15 → 2, >= 10 → 1)
  lessons: number;    // 0–2: share of topics with a lesson (>= 80% → 2, >= 40% → 1)
  interview: number;  // 0–2: Active interview questions per topic (>= 3 → 2, > 0 → 1)
  ladder: number;     // 0–1: >= 3 subject tracks and every topic sits in a track
  entryCert: number;  // 0–1: the entry certificate takes >= 50 correct answers
}

export interface SubjectMatrixCert {
  id: number;
  title: string;
  subjectTracks: number;
  /** Fewest correct answers that earn it under the platform's completion rules; null = can't be earned. */
  correctAnswersToEarn: number | null;
}

export interface SubjectMatrixRow {
  subjectId: number;
  slug: string;
  title: string;
  isPublished: boolean;
  verdict: SubjectVerdict;
  score: number;      // 0–8, sum of the breakdown
  breakdown: SubjectVerdictBreakdown;
  topics: number;
  subjectTracks: number;
  topicsWithoutTrack: number;
  activeTrivia: number;
  // Active Trivia per topic
  perTopicMin: number;
  perTopicMedian: number;
  perTopicMean: number;
  perTopicMax: number;
  pendingTrivia: number;
  pendingInterview: number;
  topicsWithLesson: number;
  activeInterview: number;
  /** Subject-native certificate with the fewest subject tracks (the first rung). */
  entryCert: SubjectMatrixCert | null;
  /** Subject-native certificate with the most subject tracks (the top rung). */
  topCert: SubjectMatrixCert | null;
}

export interface SubjectMatrixResponse {
  generatedAt: string;
  rows: SubjectMatrixRow[];
}
