import { Column, Entity, JoinColumn, OneToOne, Unique } from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';
import { DefaultLandingPageEnum } from '../../enum/default-landing-page.enum';

// One row per user, created lazily on first write (see UserPreferenceService). Every column is
// nullable with no DB default — null means "unset, use DEFAULT_USER_PREFERENCES."
@Unique(['userId'])
@Entity('user_preference')
export class UserPreference extends AbstractEntity {
  @Column({ type: 'int', nullable: false })
  userId: number;

  // ── Email notification categories ──────────────────────────────────────────
  @Column({ type: 'boolean', nullable: true, default: null })
  emailAchievements: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  emailEnrollmentConfirmations: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  emailProductUpdates: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  emailQuizReminders: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  emailWeeklyDigest: boolean | null;

  // ── Privacy ──────────────────────────────────────────────────────────────
  @Column({ type: 'boolean', nullable: true, default: null })
  isProfilePublic: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  showOnLeaderboard: boolean | null;

  // ── Navigation ───────────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: DefaultLandingPageEnum, nullable: true, default: null })
  defaultLandingPage: DefaultLandingPageEnum | null;

  // ── Locale ───────────────────────────────────────────────────────────────
  // IANA timezone name (e.g. "Asia/Kolkata"), client-supplied — null means "not set."
  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  timezone: string | null;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;
}
