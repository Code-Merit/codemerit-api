export const DEFAULT_QUIZ_LENGTH = 10; // used when client omits numQuestions
export const MAX_QUIZ_LENGTH = 25; // hard server-side ceiling, regardless of client request
export const INITIAL_ASSESSMENT_LENGTH = 20; // kept for createInitialAssessmentQuiz — must stay <= MAX_QUIZ_LENGTH

// % of a tier's own question pool (in a given topic) that must be correctly answered
// before the next tier unlocks for that topic. Reuses TOPIC_DONE's 70% meaning instead
// of inventing an unrelated number. Checked against the tier's own pool, not the whole
// topic's coverage — see question-generator.service.ts for why that distinction matters.
export const TIER_CLEAR_COVERAGE_PERCENT = 70;
