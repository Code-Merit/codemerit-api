import { DataSource } from 'typeorm';
import { QualityMetric } from 'src/common/typeorm/entities/quality-metric.entity';
import { QualityMetricSeverityEnum } from 'src/common/enum/quality-metric-severity.enum';
import { QualityMetricPolarityEnum } from 'src/common/enum/quality-metric-polarity.enum';
import { QualityResourceTypeEnum } from 'src/common/enum/quality-resource-type.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';

interface QualityMetricSeed {
  code: string;
  label: string;
  // Negative (issue) rows carry a severity; Positive rows leave it undefined — severity
  // only has meaning for something a reviewer is flagging, not praising.
  severity?: QualityMetricSeverityEnum;
  polarity?: QualityMetricPolarityEnum; // defaults to Negative below
  // undefined = applies to both Trivia and General
  questionTypeScope?: QuestionTypeEnum;
  orderIndex: number;
}

// The original 8 Medium/Severe examples are real, given by the LMS manager from actual
// review experience. Reviewed and confirmed as final (no longer placeholders): the 2
// Minor-tier rows and the 5 Positive rows. The remaining rows round out the catalog to a
// genuinely complete set across every severity/polarity combination an SME needs.
const QUALITY_METRICS: QualityMetricSeed[] = [
  // -- Severe --
  { code: 'wrong_question_or_answer', label: 'Wrong question or answer', severity: QualityMetricSeverityEnum.Severe, orderIndex: 50 },
  { code: 'question_malformed', label: 'Question malformed', severity: QualityMetricSeverityEnum.Severe, orderIndex: 60 },
  { code: 'not_relevant', label: 'Not so relevant', severity: QualityMetricSeverityEnum.Severe, orderIndex: 70 },
  { code: 'completely_irrelevant', label: 'Completely irrelevant', severity: QualityMetricSeverityEnum.Severe, orderIndex: 80 },
  { code: 'duplicate_question', label: 'Duplicate of another question', severity: QualityMetricSeverityEnum.Severe, orderIndex: 85 },
  { code: 'inappropriate_content', label: 'Offensive or inappropriate content', severity: QualityMetricSeverityEnum.Severe, orderIndex: 90 },
  // -- Medium --
  { code: 'guessable_wrong_options', label: 'Easily guessable wrong options', severity: QualityMetricSeverityEnum.Medium, questionTypeScope: QuestionTypeEnum.Trivia, orderIndex: 100 },
  { code: 'answer_too_predictable', label: 'Correct answer too long/predictable', severity: QualityMetricSeverityEnum.Medium, questionTypeScope: QuestionTypeEnum.Trivia, orderIndex: 110 },
  { code: 'question_too_complex', label: 'Question too complex to understand', severity: QualityMetricSeverityEnum.Medium, orderIndex: 120 },
  { code: 'answer_needs_improvement', label: 'Answer needs improvement', severity: QualityMetricSeverityEnum.Medium, orderIndex: 130 },
  { code: 'outdated_information', label: 'Outdated information', severity: QualityMetricSeverityEnum.Medium, orderIndex: 140 },
  { code: 'ambiguous_wording', label: 'Ambiguous wording', severity: QualityMetricSeverityEnum.Medium, orderIndex: 150 },
  { code: 'multiple_correct_not_marked', label: 'Multiple correct answers not accounted for', severity: QualityMetricSeverityEnum.Medium, questionTypeScope: QuestionTypeEnum.Trivia, orderIndex: 160 },
  // -- Minor --
  { code: 'minor_wording_grammar', label: 'Minor wording/grammar issue', severity: QualityMetricSeverityEnum.Minor, orderIndex: 170 },
  { code: 'formatting_inconsistency', label: 'Formatting inconsistency', severity: QualityMetricSeverityEnum.Minor, orderIndex: 180 },
  { code: 'could_use_better_hint', label: 'Could use a better hint', severity: QualityMetricSeverityEnum.Minor, orderIndex: 190 },
  { code: 'inconsistent_terminology', label: 'Inconsistent terminology', severity: QualityMetricSeverityEnum.Minor, orderIndex: 200 },
  // -- Positive, offered only on the Approve path of the review dialog --
  { code: 'just_acceptable', label: 'Just Acceptable', polarity: QualityMetricPolarityEnum.Positive, orderIndex: 210 },
  { code: 'good_to_know', label: 'Good to Know', polarity: QualityMetricPolarityEnum.Positive, orderIndex: 220 },
  { code: 'well_explained', label: 'Well Explained', polarity: QualityMetricPolarityEnum.Positive, orderIndex: 230 },
  { code: 'conceptual_and_highly_useful', label: 'Conceptual and Highly Useful', polarity: QualityMetricPolarityEnum.Positive, orderIndex: 240 },
  { code: 'real_world_relevant', label: 'Real-World Relevant', polarity: QualityMetricPolarityEnum.Positive, orderIndex: 250 },
  { code: 'well_structured_options', label: 'Well-Structured Options', polarity: QualityMetricPolarityEnum.Positive, questionTypeScope: QuestionTypeEnum.Trivia, orderIndex: 260 },
  { code: 'clear_and_concise', label: 'Clear and Concise', polarity: QualityMetricPolarityEnum.Positive, orderIndex: 270 },
  { code: 'great_for_beginners', label: 'Great for Beginners', polarity: QualityMetricPolarityEnum.Positive, orderIndex: 280 },
];

export async function seedQualityMetrics(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(QualityMetric);

  let created = 0;
  let skipped = 0;

  for (const m of QUALITY_METRICS) {
    const exists = await repo.findOne({ where: { code: m.code } });
    if (exists) {
      skipped++;
      continue;
    }
    await repo.save(
      repo.create({
        code: m.code,
        label: m.label,
        severity: m.severity ?? null,
        polarity: m.polarity ?? QualityMetricPolarityEnum.Negative,
        questionTypeScope: m.questionTypeScope ?? null,
        applicableResourceTypes: [QualityResourceTypeEnum.Question],
        orderIndex: m.orderIndex,
        isActive: true,
      }),
    );
    created++;
  }

  console.log(`  ✔ Quality metrics: ${created} created, ${skipped} already existed`);
}
