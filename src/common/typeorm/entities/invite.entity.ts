import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';
import { InviteTypeEnum } from 'src/common/enum/invite-type.enum';
import { InviteStatusEnum } from 'src/common/enum/invite-status.enum';
import { InviteChannelEnum } from 'src/common/enum/invite-channel.enum';

// Generic, reusable "invite someone" primitive — one table for every scenario
// (certification/badge/mock-interview/question-review/plain join), not one feature per
// scenario. See InvitesService + InviteActionHandler for the pluggable per-type accept logic.
@Index('IDX_invite_inviterId', ['inviterId'])
@Entity()
export class Invite extends AbstractEntity {
  // Unique redeemable token, entered on the post-signup referral-code page. Short and
  // human-typeable (see CODE_LENGTH in invites.constants.ts), not a UUID.
  @Column({ type: 'varchar', length: 32, unique: true, nullable: false })
  code: string;

  @Column({ type: 'integer', nullable: false })
  inviterId: number;

  @Column({ type: 'enum', enum: InviteTypeEnum, nullable: false })
  type: InviteTypeEnum;

  // Polymorphic reference, same pattern as Badge.scopeType/scopeId — not a foreign key.
  // Both null for a GENERIC "just join" invite with no specific target.
  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  targetType: string | null;

  @Column({ type: 'integer', nullable: true, default: null })
  targetId: number | null;

  // Display label for the target (e.g. a subject/badge/track name), supplied by the
  // frontend at creation time — avoids this module needing read access to Subject/
  // Badge/CertificationTrack entities just to render an email/widget label.
  @Column({ type: 'varchar', length: 150, nullable: true, default: null })
  targetLabel: string | null;

  // Null means a recipient-less, shareable "link" invite — created via the widget's "Get
  // shareable link" action, with no committed delivery channel (and therefore no email
  // ever sent for it — see InvitesService.create()).
  @Column({ type: 'enum', enum: InviteChannelEnum, nullable: true, default: null })
  channel: InviteChannelEnum | null;

  @Column({ type: 'varchar', length: 150, nullable: true, default: null })
  recipientEmail: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  recipientPhone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  note: string | null;

  @Column({
    type: 'enum',
    enum: InviteStatusEnum,
    default: InviteStatusEnum.PENDING,
  })
  status: InviteStatusEnum;

  // Set once the code is redeemed — distinct from completedAt below, which tracks
  // whether the invite's actual GOAL was fulfilled, not just that the code was used.
  @Column({ type: 'integer', nullable: true, default: null })
  acceptedByUserId: number | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  acceptedAt: Date | null;

  // GENERIC/JOURNEY: stamped synchronously by their InviteActionHandler right after
  // redeem, since the goal (account active / enrolled) is already true by then.
  // CERTIFICATION: stays null until a future hook (not wired yet) stamps it when the
  // certificate is actually issued — see AchievementService.issueCertificate().
  @Column({ type: 'datetime', nullable: true, default: null })
  completedAt: Date | null;

  @Column({ type: 'datetime', nullable: false })
  expiresAt: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inviterId', referencedColumnName: 'id' })
  inviter: User;
}
