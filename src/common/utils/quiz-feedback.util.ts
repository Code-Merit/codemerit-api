// Server-side port of the verdict-phrase generator that used to live in the frontend
// (view-result.component.ts's RESULT_PHRASES/resolveResultOutcome/pickPhrase). Moved
// here so it runs once at submit time and is persisted on QuizResult.feedback, instead
// of being recomputed (and re-randomized) on every result-page view.

type ResultTier =
  | 'poorFail' | 'fail' | 'narrowFail'
  | 'narrowPass' | 'incompletePass' | 'solidPass' | 'excellent' | 'perfect';

// {{name}} / {{score}} are replaced in pickPhrase(). Several phrases per tier so two
// people who both narrowly pass don't get the identical line.
const RESULT_PHRASES: Record<ResultTier, string[]> = {
  perfect: [
    "Perfect score, {{name}}! Every single question, nailed.",
    "Flawless! A clean 100 percent, {{name}}.",
    "That's a perfect run, {{name}} — nothing left on the table.",
    "Incredible work, {{name}}. You got {{score}} percent.",
  ],
  excellent: [
    "Excellent work, {{name}}! You scored {{score}} percent.",
    "That's a brilliant score, {{name}} — {{score}} percent, well done.",
    "Really strong performance, {{name}}. {{score}} percent is impressive.",
    "Great job, {{name}}! You're clearly on top of this subject.",
  ],
  solidPass: [
    "Nice work, {{name}}! You passed with {{score}} percent.",
    "Well done, {{name}} — that's a solid pass at {{score}} percent.",
    "Good result, {{name}}. You're building real momentum here.",
    "You passed, {{name}}! {{score}} percent is a great foundation.",
  ],
  incompletePass: [
    "You passed with {{score}} percent, {{name}} — but a few questions went unanswered. Try to attempt every question next time.",
    "Good score, {{name}}! Just remember to attempt everything — you left a few answers blank.",
    "You cleared the bar at {{score}} percent, {{name}}, though some answers were left unanswered. Worth a second look.",
  ],
  narrowPass: [
    "You passed, {{name}} — just barely, at {{score}} percent. A little more practice and you'll pull ahead comfortably.",
    "That's a pass, {{name}}, but a close one at {{score}} percent. Keep sharpening those weak spots.",
    "You made it through at {{score}} percent, {{name}}. Review the ones you missed to build a stronger margin.",
  ],
  narrowFail: [
    "So close, {{name}}! {{score}} percent — just a little short of passing. One more attempt and you've got this.",
    "Almost there, {{name}}. You were right on the edge at {{score}} percent — don't give up now.",
    "You nearly made it, {{name}}. {{score}} percent means you're closer than you think.",
  ],
  fail: [
    "You scored {{score}} percent this time, {{name}}. Review the material and give it another shot.",
    "Not quite a pass, {{name}} — {{score}} percent. Keep practicing, you're on the right track.",
    "{{score}} percent, {{name}}. A bit more preparation and you'll clear this comfortably next time.",
  ],
  poorFail: [
    "This one was tough, {{name}} — {{score}} percent. Take some time to review the basics and try again.",
    "Don't worry, {{name}}, everyone starts somewhere. {{score}} percent means there's room to grow — and you will.",
    "{{score}} percent today, {{name}}. Revisit the fundamentals and come back stronger.",
  ],
};

export interface QuizFeedbackInput {
  firstName?: string | null;
  score: number;
  total: number;
  unanswered: number;
  passMarks: number;
}

// Same pass/fail tiering convention the frontend used to apply, kept in sync
// deliberately so the phrase always agrees with the score/passMarks it describes.
function resolveResultTier(input: QuizFeedbackInput): ResultTier {
  const { score, total, unanswered, passMarks } = input;
  const passed = score >= passMarks;
  const unansweredRatio = total > 0 ? unanswered / total : 0;

  if (passed) {
    if (score >= 100 && unanswered === 0) return 'perfect';
    // A fifth or more of the quiz left blank overrides the usual score tiers —
    // completion matters even when the attempted questions went well.
    if (unansweredRatio >= 0.2) return 'incompletePass';
    if (score >= 90) return 'excellent';
    if (score >= passMarks + 10) return 'solidPass';
    return 'narrowPass';
  }
  if (score >= passMarks - 15) return 'narrowFail';
  if (score < 40) return 'poorFail';
  return 'fail';
}

export function generateQuizResultFeedback(input: QuizFeedbackInput): string {
  const tier = resolveResultTier(input);
  const pool = RESULT_PHRASES[tier];
  const template = pool[Math.floor(Math.random() * pool.length)];
  const name = input.firstName || 'there';
  const score = Math.round(Number(input.score ?? 0));
  return template.replace(/\{\{name\}\}/g, name).replace(/\{\{score\}\}/g, String(score));
}
