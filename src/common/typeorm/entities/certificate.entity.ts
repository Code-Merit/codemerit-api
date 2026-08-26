import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { CertificateStatusEnum } from 'src/common/enum/certificate-status.enum';
import { AbstractEntity } from './abstract.entity';
import { CertificationTrack } from './certification-track.entity';
import { User } from './user.entity';

@Unique(['userId', 'certificationTrackId'])
@Entity()
export class Certificate extends AbstractEntity {
  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  certificateNumber: string;

  @Column({ type: 'integer', nullable: false })
  userId: number;

  @Column({ type: 'integer', nullable: false })
  certificationTrackId: number;

  @Column({
    type: 'enum',
    enum: CertificateStatusEnum,
    default: CertificateStatusEnum.ISSUED,
  })
  status: CertificateStatusEnum;

  @Column({ type: 'datetime', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  issuedAt: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  pdfUrl: string;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  verificationCode: string;

  // Snapshot of the completion metric that actually earned this certificate, taken at issuance —
  // not recomputed later, since the underlying subject-track progress can keep changing after the
  // cert is issued. Nullable purely so `synchronize: true` can add this column to a table that
  // already has rows (pre-existing certificates stay null rather than being backfilled with a
  // guess). Column-per-cert rather than joining back to progress data on read, since "what score
  // earned this" is a historical fact, not a live-derived one.
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: null })
  scorePercentage: number | null;

  // certificationTrack.title snapshot — stored alongside rather than read fresh so a later track
  // rename doesn't silently rewrite the wording on a certificate someone already has.
  @Column({ type: 'varchar', length: 150, nullable: true, default: null })
  skillName: string | null;

  // Display label derived from scorePercentage at issuance (see achievement.service.ts
  // issueCertificate()) — this product has no separate tiering concept beyond the single
  // CERT_ACHIEVED pass bar, so this is cosmetic banding of the score, not a stored grade.
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  tierDisplayName: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => CertificationTrack, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificationTrackId' })
  certificationTrack: CertificationTrack;
}
