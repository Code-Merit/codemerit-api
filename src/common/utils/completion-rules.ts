import { CERT_ACHIEVED, TOPIC_DONE, TRACK_DONE } from 'src/common/constants/completion-thresholds';
import { computeAttemptMetrics } from 'src/common/utils/common-functions';

/**
 * The one definition of "done" at each level of the certification ladder:
 *   topic           — correct answers cover >= TOPIC_DONE% of its Trivia bank
 *   subject track   — >= TRACK_DONE% of its topics done
 *   certification   — >= its pass threshold (passThreshold ?? CERT_ACHIEVED) % of its subject tracks done
 *
 * Every completion/issuance check calls these predicates, and the minCorrectFor* functions
 * below search the same predicates, so "how many correct answers does it take" can never
 * drift from what actually completes a topic or issues a certificate.
 */

export function isTopicComplete(correctCoverage: number): boolean {
  return correctCoverage >= TOPIC_DONE;
}

export function isSubjectTrackComplete(completedTopics: number, totalTopics: number): boolean {
  return totalTopics > 0 && +((completedTopics / totalTopics) * 100).toFixed(0) >= TRACK_DONE;
}

export function isCertificationAchieved(
  completedSubjectTracks: number,
  totalSubjectTracks: number,
  threshold: number = CERT_ACHIEVED,
): boolean {
  return totalSubjectTracks > 0 && (completedSubjectTracks / totalSubjectTracks) * 100 >= threshold;
}

/** Fewest correct answers that complete a topic with `numTrivia` questions; null if it can't be completed (no Trivia). */
export function minCorrectForTopic(numTrivia: number): number | null {
  for (let correct = 0; correct <= numTrivia; correct++) {
    const { correctCoverage } = computeAttemptMetrics({
      numTrivia, attempted: correct, correct, wrong: 0,
      journeyAttempts: correct, journeyCorrect: correct, journeyWrong: 0,
    });
    if (isTopicComplete(correctCoverage)) return correct;
  }
  return null;
}

/**
 * Fewest correct answers that satisfy `isDone(k, parts.length)`, given each part's own
 * minimum (null = that part can't be completed): the cheapest k parts, for the smallest k
 * that passes. null when not enough parts are completable.
 */
function cheapestCompletion(
  partMinimums: (number | null)[],
  isDone: (completed: number, total: number) => boolean,
): number | null {
  const total = partMinimums.length;
  const needed = Array.from({ length: total + 1 }, (_, k) => k).find((k) => isDone(k, total));
  if (needed === undefined) return null;
  const completable = partMinimums.filter((m): m is number => m !== null).sort((a, b) => a - b);
  if (completable.length < needed) return null;
  return completable.slice(0, needed).reduce((sum, m) => sum + m, 0);
}

/** Fewest correct answers that complete a subject track, from its topics' question-bank sizes. */
export function minCorrectForSubjectTrack(topicNumTrivia: number[]): number | null {
  return cheapestCompletion(topicNumTrivia.map(minCorrectForTopic), isSubjectTrackComplete);
}

/** Fewest correct answers that earn a certification, from its subject tracks' own minimums. */
export function minCorrectForCertification(
  subjectTrackMinimums: (number | null)[],
  threshold: number = CERT_ACHIEVED,
): number | null {
  return cheapestCompletion(subjectTrackMinimums, (completed, total) =>
    isCertificationAchieved(completed, total, threshold),
  );
}
