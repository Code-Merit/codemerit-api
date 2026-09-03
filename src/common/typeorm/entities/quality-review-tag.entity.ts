import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { QualityMetric } from './quality-metric.entity';
import { QualityReview } from './quality-review.entity';

// Junction: which named QualityMetric issues were attached during one QualityReview pass.
@Index(['qualityReviewId', 'qualityMetricId'], { unique: true })
@Entity()
export class QualityReviewTag extends AbstractEntity {
  @Column({ type: 'int', nullable: false })
  qualityReviewId: number;

  @Column({ type: 'int', nullable: false })
  qualityMetricId: number;

  // Per-tag note, e.g. "option B basically gives it away".
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => QualityReview, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'qualityReviewId' })
  qualityReview: QualityReview;

  @ManyToOne(() => QualityMetric, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'qualityMetricId' })
  qualityMetric: QualityMetric;
}
