import { Subject } from "../typeorm/entities/subject.entity";
import { Topic } from "../typeorm/entities/topic.entity";

export const generate6DigitNumber = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getTitleBySubjectIds = (subjects: Subject[]): string => {
   // Example: join subject names with comma, or return an empty string if not available
   return subjects && subjects.length > 0 ? subjects.map((s: Subject) => s.title).join(' ') : '';
};

export const getTitleByTopicIds = (topics: Topic[]): string => {
   return topics && topics.length > 0 ? topics.map((t: Topic) => t.title).join(' ') : '';
};

// The single place the negative-marking penalty is defined. Every score calculation in
// the app must derive from this constant (via generateScore/computeAttemptMetrics) rather
// than hardcoding its own copy of "0.2" — that duplication is exactly how quiz/subject/
// job-role scores drifted out of sync with each other.
export const NEGATIVE_MARKING_RATIO = 0.2;

export const generateScore = (
  attempted: number,
  correct: number,
  wrong: number
): number => {
  if (attempted === 0) return 0;
  // Correct answers = +1 point each
  // Wrong answers = -NEGATIVE_MARKING_RATIO penalty each
  // Skipped = 0
  const rawScore = correct - wrong * NEGATIVE_MARKING_RATIO;
  const normalized = (rawScore / attempted) * 100;
  return Math.max(0, Math.min(100, Number(normalized.toFixed(1))));
};

export interface AttemptMetricsInput {
  numTrivia: number;
  attempted: number;        // distinct questions with a recorded (latest) attempt
  correct: number;          // distinct questions currently correct (latest attempt per question)
  wrong: number;            // distinct questions currently wrong (latest attempt per question)
  journeyAttempts: number;  // every attempt ever, retries included
  journeyCorrect: number;   // every correct attempt ever, retries included
  journeyWrong: number;     // every wrong attempt ever, retries included
}

export interface AttemptMetrics {
  coverage: number;         // % of numTrivia ever attempted, regardless of correctness
  correctCoverage: number;  // % of numTrivia currently answered correctly — the only one
                             // of these that should ever gate completion/certification
  currentAccuracy: number;  // correct / attempted — "what you currently know"
  score: number;            // generateScore() over current-standing counts
  journeyAccuracy: number;  // correct / attempted across ALL-time attempts — "how rough was the path"
  journeyScore: number;     // generateScore() over all-time counts
}

/**
 * The single source of truth for every "how is this user doing" number shown at
 * subject/topic/subjectTrack level. Before this existed, this exact formula was
 * independently reimplemented in four different services — which is exactly how a
 * subject's `wrong` count and the sum of its subjectTracks' `wrong` counts drifted
 * out of sync, and how a certificate could be earned without answering anything
 * correctly (see docs/Auto-Certification-and-Gamification-Layer.md §12-13). Every
 * caller of this function gets the same fix, forever, instead of once per copy.
 */
export function computeAttemptMetrics(input: AttemptMetricsInput): AttemptMetrics {
  const { numTrivia, attempted, correct, wrong, journeyAttempts, journeyCorrect, journeyWrong } = input;

  const coverage = numTrivia > 0 ? +((attempted / numTrivia) * 100).toFixed(1) : 0;
  const correctCoverage = numTrivia > 0 ? +((correct / numTrivia) * 100).toFixed(1) : 0;
  const currentAccuracy = attempted > 0 ? +((correct * 100) / attempted).toFixed(1) : 0;
  const score = +generateScore(attempted, correct, wrong).toFixed(0);
  const journeyAccuracy = journeyAttempts > 0 ? +((journeyCorrect * 100) / journeyAttempts).toFixed(1) : 0;
  const journeyScore = +generateScore(journeyAttempts, journeyCorrect, journeyWrong).toFixed(0);

  return { coverage, correctCoverage, currentAccuracy, score, journeyAccuracy, journeyScore };
}

export type AggregateUserLevel =
  | 'Not Started'
  | 'Novice'
  | 'Beginner'
  | 'Intermediate'
  | 'Proficient'
  | 'Expert';

// 'Expert' additionally requires real exposure to Advanced-difficulty questions specifically —
// without this, depth/breadth alone could theoretically be satisfied by Easy+Intermediate
// answers without the user ever having proven anything on hard content. Real bug found via a
// live response under an earlier version of this function: attemptedHard=1, correctHard=1 (100%
// "accuracy" on a sample of one) produced the top label for a subject-track at 0% progress.
const MIN_ADVANCED_TIER_ATTEMPTS_FOR_EXPERT = 3;

// Depth = difficulty-weighted accuracy (0-100) across every tier actually attempted, blended
// rather than picking whichever single tier was touched — harder tiers count for more, but
// nothing is discarded the way an old "any Intermediate attempt overrides all Easy-tier
// evidence" design used to.
const EASY_WEIGHT = 1;
const INTERMEDIATE_WEIGHT = 2;
const ADVANCED_WEIGHT = 3;

const MIN_DEPTH_FOR_BEGINNER = 40;
const MIN_DEPTH_FOR_INTERMEDIATE = 55;
const MIN_DEPTH_FOR_PROFICIENT = 70;
const MIN_DEPTH_FOR_EXPERT = 85;

// Breadth = correctCoveragePercent — % of the WHOLE scope's trivia bank answered correctly, not
// just the attempted subset. Deliberately steep: Intermediate+ requires having correctly
// answered a majority of the scope, not just done well on whatever slice was attempted.
const MIN_COVERAGE_FOR_BEGINNER = 10;
const MIN_COVERAGE_FOR_INTERMEDIATE = 51;
const MIN_COVERAGE_FOR_PROFICIENT = 71;
const MIN_COVERAGE_FOR_EXPERT = 91;

/**
 * Classifies a user's current level for a topic/subject-track/subject/job-role from their
 * attempted/correct counts per difficulty tier, plus that scope's overall correctCoverage
 * (0-100 — pass computeAttemptMetrics()'s correctCoverage straight through).
 *
 * Replaces an earlier "pick whichever tier has any attempts, highest wins" design that had two
 * compounding problems, both found via live data:
 * - A single Intermediate-tier attempt completely overrode all Easy-tier evidence (mutually
 *   exclusive branches) — someone with 40 easy answers and 2 lucky intermediate ones was judged
 *   only on the 2.
 * - The coverage floor guarding against "small unrepresentative sample" only ever protected the
 *   top one or two labels — 'Intermediate' had no coverage gate at all, so 2-3 intermediate-tier
 *   attempts could label an entire subject/job-role 'Intermediate' at 5-10% overall coverage.
 *
 * This version scores two independent axes and requires BOTH to clear a rung, at every rung
 * above Novice — not just the top two:
 * - depth: difficulty-weighted accuracy across every attempted tier (blended, not winner-take-all)
 * - breadth: correctCoveragePercent — how much of the whole scope is actually mastered
 *
 * 'Not Started' is the only gate on raw attempt count (totalAttempted === 0). 'Novice' is the
 * plain default the moment someone has attempted anything at all — any depth/breadth above zero
 * — right up until they clear Beginner's bar; there's no separate minimum-attempts floor beyond
 * that, since the coverage requirement on every higher rung already does that job (a single
 * attempt against a real-sized question bank won't clear even Beginner's 10% breadth bar).
 */
export const getAggregateUserLevel = (
  attemptedEasy: number,
  correctEasy: number,
  attemptedIntermediate: number,
  correctIntermediate: number,
  attemptedAdvanced: number,
  correctAdvanced: number,
  correctCoveragePercent = 100,
): AggregateUserLevel => {
  const totalAttempted = attemptedEasy + attemptedIntermediate + attemptedAdvanced;
  if (totalAttempted === 0) return 'Not Started';

  const weightedAttempted =
    attemptedEasy * EASY_WEIGHT + attemptedIntermediate * INTERMEDIATE_WEIGHT + attemptedAdvanced * ADVANCED_WEIGHT;
  const weightedCorrect =
    correctEasy * EASY_WEIGHT + correctIntermediate * INTERMEDIATE_WEIGHT + correctAdvanced * ADVANCED_WEIGHT;
  const depth = weightedAttempted > 0 ? (weightedCorrect / weightedAttempted) * 100 : 0;

  const breadth = correctCoveragePercent;
  const advancedTrusted = attemptedAdvanced >= MIN_ADVANCED_TIER_ATTEMPTS_FOR_EXPERT;

  if (depth >= MIN_DEPTH_FOR_EXPERT && breadth >= MIN_COVERAGE_FOR_EXPERT && advancedTrusted) return 'Expert';
  if (depth >= MIN_DEPTH_FOR_PROFICIENT && breadth >= MIN_COVERAGE_FOR_PROFICIENT) return 'Proficient';
  if (depth >= MIN_DEPTH_FOR_INTERMEDIATE && breadth >= MIN_COVERAGE_FOR_INTERMEDIATE) return 'Intermediate';
  if (depth >= MIN_DEPTH_FOR_BEGINNER && breadth >= MIN_COVERAGE_FOR_BEGINNER) return 'Beginner';
  return 'Novice';
};

export function shuffleArray(array) {
  // Used for randomzing Don't mutate the original array
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Swap
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}


