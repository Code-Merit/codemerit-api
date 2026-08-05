import { Entity, Column, JoinColumn, OneToOne } from 'typeorm';
import { User } from './user.entity';
import { AbstractEntity } from './abstract.entity';
import { IProfile } from '../interface/profile.interface';
import { WorkStatusEnum } from 'src/core/users/enums/work-status.enum';
import { IntentEnum } from 'src/core/users/enums/intent.enum';
import { TimelineEnum } from 'src/core/users/enums/timeline.enum';
import { ReferralSourceEnum } from 'src/core/users/enums/referral-source.enum';

@Entity()
export class Profile extends AbstractEntity implements IProfile {
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    default: null,
  })
  linkedinUrl: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    default: null,
  })
  about: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    default: null,
  })
  googleId: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    default: null,
  })
  linkedinId: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    default: null,
  })
  auth_provider: string;

  @Column({
    type: 'int',
    nullable: true,
    default: null,
  })
  experience: number;

  @Column({
    type: 'enum',
    enum: WorkStatusEnum,
    nullable: true,
    default: null,
  })
  workStatus: WorkStatusEnum;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: null,
  })
  collegeName: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: null,
  })
  stream: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    default: null,
  })
  passingYear: string;

  @Column({
    type: 'boolean',
    nullable: true,
    default: null,
  })
  hasCompletedInternship: boolean;

  @Column({
    type: 'int',
    nullable: true,
    default: null,
  })
  internshipDuration: number;

  @Column({
    type: 'boolean',
    nullable: true,
    default: null,
  })
  isCurrentlyEmployed: boolean;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: null,
  })
  companyName: string;

  @Column({
    type: 'int',
    nullable: true,
    default: null,
  })
  subjectTrackId: number;

  @Column({
    type: 'int',
    nullable: true,
    default: null,
  })
  masteryLevel: number;

  // Onboarding "Goals" step — all three optional/skippable, unlike the workStatus branch
  // fields above which are conditionally required. No @ValidateIf gating on these in the DTO.
  @Column({
    type: 'enum',
    enum: IntentEnum,
    nullable: true,
    default: null,
  })
  intent: IntentEnum;

  @Column({
    type: 'enum',
    enum: TimelineEnum,
    nullable: true,
    default: null,
  })
  timeline: TimelineEnum;

  @Column({
    type: 'enum',
    enum: ReferralSourceEnum,
    nullable: true,
    default: null,
  })
  referralSource: ReferralSourceEnum;

  // Server-managed only — flips to true the moment a valid workStatus branch is submitted via
  // UserProfileService.updateProfile. Never settable directly by the client (see the explicit
  // strip in updateProfile), so the frontend can trust it as "has this user actually completed
  // the post-registration profile form," not "did they claim to."
  @Column({
    type: 'boolean',
    default: false,
  })
  profileCompleted: boolean;

  @Column({
    type: 'integer',
    default: null,
  })
  userId: number;

  @OneToOne((type) => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;
}
