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

export const generateScore = (
  attempted: number,
  correct: number,
  wrong: number
): number => {
  if (attempted === 0) return 0;
  // Correct answers = +1 point each
  // Wrong answers = -0.2 penalty each (20% negative marking)
  // Skipped = 0
  const rawScore = correct - wrong * 0.2;
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
  | 'Developing'
  | 'Intermediate'
  | 'Proficient'
  | 'Advanced';

// Below this many attempts TOTAL (across all tiers combined), there isn't enough
// signal yet to trust any tier's accuracy % — stay at 'Novice' rather than guess.
const MIN_ATTEMPTS_FOR_CONFIDENCE = 3;

// A tier's accuracy (or even its mere exposure, in the Proficient check below) is
// only trusted once the user has attempted at least this many questions AT THAT
// SPECIFIC TIER. The aggregate gate above only protects against near-total
// inexperience (e.g. 1 attempt total) — it does nothing to stop a single lucky
// Advanced-tier guess from labeling an entire subject/track "Advanced" while the
// rest of it (and every easier tier) is still barely explored. Real bug found via a
// live response: attemptedHard=1, correctHard=1 (100% "accuracy" on a sample of
// one) produced userLevel="Advanced" for a subject-track at 0% progress. Same
// number as MIN_ATTEMPTS_FOR_CONFIDENCE, reused rather than inventing a second
// magic constant — both express "don't trust a sample this small."
const MIN_TIER_ATTEMPTS_FOR_CONFIDENCE = MIN_ATTEMPTS_FOR_CONFIDENCE;

// Minimum overall correctCoverage (0-100, % of the scope's total trivia questions
// answered correctly) required to be TRUSTED for the two highest labels. Without
// this, someone who's barely dipped into a subject/track (e.g. 6 of 189 questions)
// but did well on that small sample gets called 'Proficient'/'Advanced' — accurate
// about the sample, misleading about the whole. Real bug found via live data: a
// subject at 5.8% coverage, 91% accuracy on 11 questions, computed 'Advanced' from
// accuracy alone. Coverage only ever CAPS the accuracy-derived label down a rung
// (or two) — it never boosts a weak accuracy record up, and it never touches
// Intermediate/Developing/Beginner/Novice, which don't claim broad mastery in the
// first place. Tunable — picked as reasonable defaults, not derived from data.
const MIN_COVERAGE_FOR_PROFICIENT = 15;
const MIN_COVERAGE_FOR_ADVANCED = 25;

/**
 * Classifies a user's current level for a topic/subject-track/subject from their
 * attempted/correct counts per difficulty tier, plus that scope's overall
 * correctCoverage (0-100 — pass computeAttemptMetrics()'s correctCoverage straight
 * through, no need to recompute it). Three gates:
 * - MIN_ATTEMPTS_FOR_CONFIDENCE on the TOTAL across all tiers — a topic's attempts
 *   are often split thin across tiers, and requiring 3 in the *same* tier here
 *   would misclassify a clean 3/3 spread across Easy+Intermediate as 'Novice'.
 * - MIN_TIER_ATTEMPTS_FOR_CONFIDENCE, applied ONLY to the Advanced tier (both the
 *   top-level 'Advanced' check and the "advanced exposure" half of the Proficient
 *   check) — without it, 1-2 lucky/unlucky attempts at the hardest tier can
 *   outrank a much larger, well-established track record at Easy/Intermediate.
 *   Intentionally NOT applied to Intermediate/Easy branch entry — see the inline
 *   comment above the Intermediate check for why that regressed a valid case.
 * - MIN_COVERAGE_FOR_PROFICIENT/ADVANCED — see that constant's comment above.
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
  if (totalAttempted < MIN_ATTEMPTS_FOR_CONFIDENCE) return 'Novice';

  const easyAccuracy = attemptedEasy > 0 ? correctEasy / attemptedEasy : 0;
  const intermediateAccuracy = attemptedIntermediate > 0 ? correctIntermediate / attemptedIntermediate : 0;
  const advancedAccuracy = attemptedAdvanced > 0 ? correctAdvanced / attemptedAdvanced : 0;

  const advancedTrusted = attemptedAdvanced >= MIN_TIER_ATTEMPTS_FOR_CONFIDENCE;

  let accuracyLevel: AggregateUserLevel;
  if (advancedTrusted && advancedAccuracy >= 0.5) {
    accuracyLevel = 'Advanced';
  } else if (attemptedIntermediate > 0) {
    // Deliberately plain > 0 for branch entry here (not a trust-gate) - a topic's
    // attempts are often split thin across tiers, and requiring a per-tier minimum
    // to even consider Intermediate/Easy would misclassify a clean, 100%-correct
    // spread (e.g. 2 easy + 1 medium + 1 hard, all correct) down to 'Novice'. Only
    // the Advanced tier (above) and the advanced-exposure half of the Proficient
    // check (below) need the stricter gate.
    if (intermediateAccuracy >= 0.75 || advancedTrusted) accuracyLevel = 'Proficient';
    else if (intermediateAccuracy >= 0.5) accuracyLevel = 'Intermediate';
    else accuracyLevel = 'Developing';
  } else if (attemptedEasy > 0) {
    if (easyAccuracy >= 0.75) accuracyLevel = 'Developing';
    else if (easyAccuracy >= 0.4) accuracyLevel = 'Beginner';
    else accuracyLevel = 'Novice';
  } else {
    accuracyLevel = 'Novice';
  }

  // Coverage can only cap the accuracy-derived level DOWN, never boost it up.
  if (accuracyLevel === 'Advanced' && correctCoveragePercent < MIN_COVERAGE_FOR_ADVANCED) {
    return correctCoveragePercent >= MIN_COVERAGE_FOR_PROFICIENT ? 'Proficient' : 'Intermediate';
  }
  if (accuracyLevel === 'Proficient' && correctCoveragePercent < MIN_COVERAGE_FOR_PROFICIENT) {
    return 'Intermediate';
  }
  return accuracyLevel;
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


