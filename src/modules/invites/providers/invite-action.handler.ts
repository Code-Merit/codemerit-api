import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from 'src/common/typeorm/entities/invite.entity';
import { Badge } from 'src/common/typeorm/entities/badge.entity';
import { Permission } from 'src/common/typeorm/entities/permission.entity';
import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { UserPermissionEnum, UserPermissionTitleEnum } from 'src/common/policies/user-permission.enum';
import { SkillEnrollmentService } from 'src/modules/skill-enrollment/providers/skill-enrollment.service';
import { UserPermissionService } from 'src/modules/user-permission/providers/user-permission.service';

export interface InviteActionResult {
  // Whether InvitesService should stamp completedAt = now right after this call.
  // false means the invite's actual goal (certificate issued, badge earned, interview
  // attended) happens later via a different part of the app — left null here until a
  // future hook stamps it, same bucket as the CERTIFICATION hook noted in the plan.
  completedNow: boolean;
}

export interface InviteActionHandler {
  execute(invite: Invite, newUserId: number): Promise<InviteActionResult>;
}

// GENERIC: no target. By the time redeem runs the recipient is already registered and
// active (OTP/social verification already happened earlier in the signup flow) — so
// redeeming a GENERIC code *is* fulfilling it.
@Injectable()
export class GenericInviteHandler implements InviteActionHandler {
  async execute(): Promise<InviteActionResult> {
    return { completedNow: true };
  }
}

// JOURNEY: targetId is a Subject. Completion = enrolled, which this call itself performs.
@Injectable()
export class JourneyInviteHandler implements InviteActionHandler {
  constructor(private readonly skillEnrollmentService: SkillEnrollmentService) {}

  async execute(invite: Invite, newUserId: number): Promise<InviteActionResult> {
    if (invite.targetId) {
      await this.skillEnrollmentService.enrollBasicBatch(newUserId, [invite.targetId]);
    }
    return { completedNow: true };
  }
}

// CERTIFICATION: targetId is a CertificationTrack's subjectId (frontend resolves and
// passes the subjectId as targetId — this module has no need to read CertificationTrack
// itself). Enrolling here only gets the recipient started; earning the certificate is a
// later, separate event owned by AchievementService — completedAt stays null until that
// future hook (explicitly deferred, see the plan) stamps it.
@Injectable()
export class CertificationInviteHandler implements InviteActionHandler {
  constructor(private readonly skillEnrollmentService: SkillEnrollmentService) {}

  async execute(invite: Invite, newUserId: number): Promise<InviteActionResult> {
    if (invite.targetId) {
      await this.skillEnrollmentService.enrollBasicBatch(newUserId, [invite.targetId]);
    }
    return { completedNow: false };
  }
}

// BADGE: targetId is a Badge id. Enrolls in whatever subject/job-role the badge is scoped
// to (a GLOBAL/TOPIC-scoped badge has nothing to enroll in). Earning the badge itself is a
// later event (same deferred bucket as CERTIFICATION) — completedAt stays null.
@Injectable()
export class BadgeInviteHandler implements InviteActionHandler {
  constructor(
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    private readonly skillEnrollmentService: SkillEnrollmentService,
  ) {}

  async execute(invite: Invite, newUserId: number): Promise<InviteActionResult> {
    if (invite.targetId) {
      const badge = await this.badgeRepo.findOne({ where: { id: invite.targetId } });
      if (badge?.scopeType === BadgeScopeEnum.SUBJECT && badge.scopeId) {
        await this.skillEnrollmentService.enrollBasicBatch(newUserId, [badge.scopeId]);
      } else if (badge?.scopeType === BadgeScopeEnum.JOBROLE && badge.scopeId) {
        const breakdown = await this.skillEnrollmentService.getJobRoleSubjectsBreakdown(
          newUserId,
          badge.scopeId,
        );
        const subjectIds = breakdown.subjects.map((s) => s.subjectId);
        if (subjectIds.length) {
          await this.skillEnrollmentService.enrollBasicBatch(newUserId, subjectIds, badge.scopeId);
        }
      }
    }
    return { completedNow: false };
  }
}

// MOCK_INTERVIEW: targetId is a JobRole id. Enrolls in the role's subjects so the
// recipient has real access to prep with before an interview — actually scheduling/
// attending one is a separate, later flow through the existing Interview module, so
// completedAt stays null (deferred, same as CERTIFICATION/BADGE) rather than this handler
// guessing at a booking.
@Injectable()
export class MockInterviewInviteHandler implements InviteActionHandler {
  constructor(private readonly skillEnrollmentService: SkillEnrollmentService) {}

  async execute(invite: Invite, newUserId: number): Promise<InviteActionResult> {
    if (invite.targetId) {
      const breakdown = await this.skillEnrollmentService.getJobRoleSubjectsBreakdown(
        newUserId,
        invite.targetId,
      );
      const subjectIds = breakdown.subjects.map((s) => s.subjectId);
      if (subjectIds.length) {
        await this.skillEnrollmentService.enrollBasicBatch(newUserId, subjectIds, invite.targetId);
      }
    }
    return { completedNow: false };
  }
}

// QUESTION_REVIEW: targetId is a Subject id. Instant-grant (per the explicit decision made
// during planning — no admin approval queue), via the existing scoped Question:Review
// permission (same grant table/guard the SME quality-review queue already checks — see
// QuestionReviewAccessGuard). Granting the permission IS the fulfillment here, unlike
// BADGE/CERTIFICATION — there's no later event to wait for, so completedAt is set now.
@Injectable()
export class QuestionReviewInviteHandler implements InviteActionHandler {
  constructor(
    @InjectRepository(Permission) private readonly permissionRepo: Repository<Permission>,
    private readonly userPermissionService: UserPermissionService,
  ) {}

  async execute(invite: Invite, newUserId: number): Promise<InviteActionResult> {
    if (invite.targetId) {
      const permission = await this.permissionRepo.findOne({
        where: { permission: UserPermissionEnum.QuestionReview },
      });
      if (permission) {
        await this.userPermissionService.grantPermission({
          userId: newUserId,
          permissionIds: [permission.id],
          resourceType: UserPermissionTitleEnum.Subject,
          resourceId: invite.targetId,
        });
      }
    }
    return { completedNow: true };
  }
}
