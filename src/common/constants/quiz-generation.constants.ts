export const DEFAULT_QUIZ_LENGTH = 10; // used when client omits numQuestions
export const MAX_QUIZ_LENGTH = 25; // hard server-side ceiling, regardless of client request
export const INITIAL_ASSESSMENT_LENGTH = 20; // kept for createInitialAssessmentQuiz — must stay <= MAX_QUIZ_LENGTH

// % of a tier's own question pool (in a given topic) that must be correctly answered
// before the next tier unlocks for that topic. Reuses TOPIC_DONE's 70% meaning instead
// of inventing an unrelated number. Checked against the tier's own pool, not the whole
// topic's coverage — see question-generator.service.ts for why that distinction matters.
export const TIER_CLEAR_COVERAGE_PERCENT = 70;

// Whether self-serve quiz generation (take-quiz + Quick Practice, both via
// QuestionGeneratorService.generateUserQuiz) may serve a question the learner has already
// attempted but not answered correctly.
//   false (default): every quiz is UNIQUE — any question with a question_attempt row for the
//     user (correct, wrong or skipped) is never selected again, so nothing feels repeated and
//     each result reflects first-time answers only.
//   true: the older behaviour — only correctly-answered questions are excluded, so wrong and
//     skipped ones come back in later quizzes.
export const REPRESENT_WRONG_ATTEMPTS = false;
