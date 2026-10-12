import * as crypto from 'crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { Invite } from 'src/common/typeorm/entities/invite.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { InviteTypeEnum } from 'src/common/enum/invite-type.enum';
import { InviteStatusEnum } from 'src/common/enum/invite-status.enum';
import { InviteChannelEnum } from 'src/common/enum/invite-channel.enum';
import { MailService } from 'src/common/mail/providers/mail.service';
import { CreateInviteDto } from '../dtos/create-invite.dto';
import { RedeemInviteDto } from '../dtos/redeem-invite.dto';
import { InviteActionHandler } from './invite-action.handler';
import {
  INVITE_ACTION_HANDLERS,
  INVITE_CODE_LENGTH,
  INVITE_EXPIRY_DAYS,
} from '../constants/invites.constants';

export interface InviteStats {
  myInviteCount: number;
  myAcceptedCount: number;
  // Still redeemable right now — PENDING and not past expiresAt. Distinct from a plain
  // `status = PENDING` count: expiry is only flipped to EXPIRED lazily, the moment
  // someone actually tries to redeem a lapsed code (see redeem()) — there's no sweep
  // job — so a stored-status-only count would overstate "still pending."
  myPendingCount: number;
  // EXPIRED by stored status, OR still PENDING but past expiresAt (not yet lazily
  // flipped) — the honest "no longer usable, never redeemed" count for the same reason.
  myExpiredCount: number;
  topInviters: { userId: number; name: string; acceptedCount: number }[];
}

export interface PublicInviteInfo {
  type: InviteTypeEnum;
  targetLabel: string | null;
  inviterName: string;
  expired: boolean;
}

export interface RedeemResult {
  invite: Invite | null;
  skipped: boolean;
}

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    @InjectRepository(Invite) private readonly inviteRepo: Repository<Invite>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @Inject(INVITE_ACTION_HANDLERS)
    private readonly handlers: Map<InviteTypeEnum, InviteActionHandler>,
    private readonly mailService: MailService,
  ) {}

  /** Idempotent: re-inviting the same recipient for the same inviter+type+target reuses
   * the existing PENDING row (fresh code lifetime, updated note/label) instead of
   * spawning a duplicate — closes an obvious "spam re-invite" path. */
  async create(dto: CreateInviteDto, inviterId: number): Promise<Invite> {
    const isEmail = dto.channel === InviteChannelEnum.EMAIL;
    const isPhone = dto.channel === InviteChannelEnum.PHONE;
    // No channel at all = a recipient-less, shareable "link" invite — the widget's
    // "Get shareable link" action. Only enforce a recipient when the caller actually
    // committed to a delivery channel.
    if (isEmail && !dto.recipientEmail) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'recipientEmail is required for an Email invite.');
    }
    if (isPhone && !dto.recipientPhone) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'recipientPhone is required for a Phone invite.');
    }

    const existing = await this.inviteRepo.findOne({
      where: {
        inviterId,
        type: dto.type,
        targetType: dto.targetType ?? null,
        targetId: dto.targetId ?? null,
        recipientEmail: isEmail ? dto.recipientEmail : null,
        recipientPhone: isPhone ? dto.recipientPhone : null,
        status: InviteStatusEnum.PENDING,
      },
    });

    let invite: Invite;
    if (existing) {
      existing.expiresAt = this.computeExpiry();
      // `!== undefined` (not `??`) so an explicit `null` — "clear this" — is honored
      // instead of falling back to the stale value the same as an omitted field would.
      if (dto.note !== undefined) existing.note = dto.note;
      if (dto.targetLabel !== undefined) existing.targetLabel = dto.targetLabel;
      invite = await this.inviteRepo.save(existing);
    } else {
      invite = await this.inviteRepo.save(
        this.inviteRepo.create({
          code: await this.generateUniqueCode(),
          inviterId,
          type: dto.type,
          targetType: dto.targetType ?? null,
          targetId: dto.targetId ?? null,
          targetLabel: dto.targetLabel ?? null,
          channel: dto.channel ?? null,
          recipientEmail: isEmail ? dto.recipientEmail : null,
          recipientPhone: isPhone ? dto.recipientPhone : null,
          note: dto.note ?? null,
          expiresAt: this.computeExpiry(),
        }),
      );
    }

    // Phone invites have nowhere to be sent yet — there's no SMS provider anywhere in
    // this codebase. The row/code is still created (so a Phone invite can be shared
    // manually, e.g. via WhatsApp) but only Email actually dispatches here.
    if (isEmail && invite.recipientEmail) {
      const inviter = await this.userRepo.findOne({ where: { id: inviterId } });
      const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : 'A CodeMerit member';
      await this.mailService.sendInviteEmail(
        invite.recipientEmail,
        inviterName,
        invite.code,
        invite.targetLabel ?? undefined,
        invite.note ?? undefined,
      );
    }

    return invite;
  }

  /** `dto.code` omitted = Skip on the referral-code page — still stamps
   * Profile.inviteCodePromptedAt so AuthGuard never shows that page again. */
  async redeem(dto: RedeemInviteDto, userId: number): Promise<RedeemResult> {
    if (!dto.code) {
      await this.markPrompted(userId);
      return { invite: null, skipped: true };
    }

    const invite = await this.inviteRepo.findOne({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (!invite) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'Invalid invite code.');
    }
    if (invite.inviterId === userId) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'You cannot redeem your own invite code.');
    }
    if (invite.status !== InviteStatusEnum.PENDING) {
      throw new AppCustomException(HttpStatus.CONFLICT, 'This invite code has already been used.');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      invite.status = InviteStatusEnum.EXPIRED;
      await this.inviteRepo.save(invite);
      throw new AppCustomException(HttpStatus.GONE, 'This invite code has expired.');
    }

    // Atomically claim the invite on its status column — closes the TOCTOU race where
    // two concurrent redeem calls for the same code both pass the PENDING check above
    // before either commits, which would otherwise let the same code grant its reward
    // (enrollment, permission, etc.) to two different users. Only the request whose
    // conditional UPDATE actually matches a row (affected === 1) proceeds past this
    // point; the loser sees the same "already used" conflict a legitimately-late
    // redeemer would.
    const acceptedAt = new Date();
    const claim = await this.inviteRepo.update(
      { id: invite.id, status: InviteStatusEnum.PENDING },
      { status: InviteStatusEnum.ACCEPTED, acceptedByUserId: userId, acceptedAt },
    );
    if (!claim.affected) {
      throw new AppCustomException(HttpStatus.CONFLICT, 'This invite code has already been used.');
    }
    invite.status = InviteStatusEnum.ACCEPTED;
    invite.acceptedByUserId = userId;
    invite.acceptedAt = acceptedAt;

    const handler = this.handlers.get(invite.type);
    const result = handler
      ? await handler.execute(invite, userId)
      : { completedNow: false };

    if (result.completedNow) {
      invite.completedAt = new Date();
      await this.inviteRepo.update(invite.id, { completedAt: invite.completedAt });
    }
    await this.markPrompted(userId);

    return { invite, skipped: false };
  }

  /** Public (no auth) — just enough for the /invite/:code landing page to render an
   * honest "X invited you to Y" before the visitor commits to signing up. Deliberately
   * narrow: no email/id/code echoed back, nothing a scraper could use to enumerate
   * recipients. `expired` covers both a genuinely expired PENDING row and an
   * already-redeemed one — the landing page doesn't need to distinguish why a code is
   * no longer usable, only whether to show the accept flow or a "this invite is no
   * longer valid" state. */
  async getPublicInfo(code: string): Promise<PublicInviteInfo> {
    const invite = await this.inviteRepo.findOne({
      where: { code: code.trim().toUpperCase() },
    });
    if (!invite) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'Invalid invite code.');
    }
    const inviter = await this.userRepo.findOne({ where: { id: invite.inviterId } });
    const expired =
      invite.status !== InviteStatusEnum.PENDING || invite.expiresAt.getTime() < Date.now();
    return {
      type: invite.type,
      targetLabel: invite.targetLabel,
      inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : 'A CodeMerit member',
      expired,
    };
  }

  /** Powers the dashboard widget — the caller's own counts plus a small top-inviters
   * leaderboard, computed live (same style as MeritService's XP leaderboard) rather than
   * a stored table, and respecting the same UserPreference.showOnLeaderboard opt-out. */
  async getStats(userId: number): Promise<InviteStats> {
    const now = new Date();
    const [myInviteCount, myAcceptedCount, myPendingCount, myExpiredCount] = await Promise.all([
      this.inviteRepo.count({ where: { inviterId: userId } }),
      this.inviteRepo.count({ where: { inviterId: userId, status: InviteStatusEnum.ACCEPTED } }),
      this.inviteRepo.count({
        where: { inviterId: userId, status: InviteStatusEnum.PENDING, expiresAt: MoreThan(now) },
      }),
      this.inviteRepo.count({
        where: [
          { inviterId: userId, status: InviteStatusEnum.EXPIRED },
          { inviterId: userId, status: InviteStatusEnum.PENDING, expiresAt: LessThanOrEqual(now) },
        ],
      }),
    ]);

    const rows = await this.inviteRepo.manager
      .createQueryBuilder()
      .select('i.inviterId', 'userId')
      .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
      .addSelect('COUNT(*)', 'acceptedCount')
      .from('invite', 'i')
      .innerJoin('user', 'u', 'u.id = i.inviterId')
      .leftJoin('user_preference', 'up', 'up.userId = u.id')
      .where('i.status = :status', { status: InviteStatusEnum.ACCEPTED })
      .andWhere('(up.showOnLeaderboard IS NULL OR up.showOnLeaderboard = 1)')
      .groupBy('i.inviterId')
      .addGroupBy('u.firstName')
      .addGroupBy('u.lastName')
      .orderBy('acceptedCount', 'DESC')
      .limit(10)
      .getRawMany();

    const topInviters = rows.map((r) => ({
      userId: +r.userId,
      name: r.name,
      acceptedCount: +r.acceptedCount,
    }));

    return { myInviteCount, myAcceptedCount, myPendingCount, myExpiredCount, topInviters };
  }

  private async markPrompted(userId: number): Promise<void> {
    await this.profileRepo.update({ userId }, { inviteCodePromptedAt: new Date() });
  }

  private computeExpiry(): Date {
    const date = new Date();
    date.setDate(date.getDate() + INVITE_EXPIRY_DAYS);
    return date;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = crypto
        .randomBytes(INVITE_CODE_LENGTH)
        .toString('hex')
        .toUpperCase()
        .slice(0, INVITE_CODE_LENGTH);
      const exists = await this.inviteRepo.findOne({ where: { code } });
      if (!exists) return code;
    }
    throw new AppCustomException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Could not generate a unique invite code. Please try again.',
    );
  }
}
