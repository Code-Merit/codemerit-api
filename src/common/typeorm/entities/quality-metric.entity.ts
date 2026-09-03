import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QualityMetricSeverityEnum } from 'src/common/enum/quality-metric-severity.enum';
import { QualityMetricPolarityEnum } from 'src/common/enum/quality-metric-polarity.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';

// Catalog of named, reusable content-quality issue tags an SME can attach to a
// QualityReview (e.g. "Easily guessable wrong options", "Wrong question or answer").
// Admin/seed-managed in v1 — no create/edit UI yet.
@Entity()
export class QualityMetric extends AbstractEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Null for Positive-polarity tags — severity only has meaning for a flagged issue.
  @Column({ type: 'enum', enum: QualityMetricSeverityEnum, nullable: true })
  severity: QualityMetricSeverityEnum | null;

  // Positive tags (e.g. "Good to Know") are attachable only when a reviewer approves a
  // question; Negative tags (the original severity-tiered issue catalog) only when they
  // reject it. Same junction table (QualityReviewTag) either way — polarity just decides
  // which half of the catalog the review dialog offers for the chosen decision.
  @Column({ type: 'enum', enum: QualityMetricPolarityEnum, default: QualityMetricPolarityEnum.Negative })
  polarity: QualityMetricPolarityEnum;

  // 'simple-json' (not 'json') — see Lesson.tags for why: MariaDB has no native JSON
  // type, and TypeORM's schema-diff would otherwise DROP+ADD this column on every
  // synchronize. Stores as plain TEXT, round-trips as string[].
  @Column({ type: 'simple-json', nullable: true })
  applicableResourceTypes: string[] | null;

  // Null = applies to both Trivia and General questions.
  @Column({ type: 'enum', enum: QuestionTypeEnum, nullable: true })
  questionTypeScope: QuestionTypeEnum | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  orderIndex: number;

  @Column({ type: 'int', nullable: true, default: null })
  createdBy: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  updatedBy: number | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdBy' })
  createdByUser?: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedBy' })
  updatedByUser?: User;
}
