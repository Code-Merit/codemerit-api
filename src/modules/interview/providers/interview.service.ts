import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Interview } from 'src/common/typeorm/entities/interview.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { InterviewStatusHistory } from 'src/common/typeorm/entities/interview-status-history.entity';
import { InterviewStatusEnum } from 'src/common/enum/interview-status.enum';
import { AssessmentSessionStatusEnum } from 'src/common/enum/assessment-session-status.enum';
import { RatingTypeEnum } from 'src/common/enum/rating-type.enum';
import { UserService } from 'src/core/users/providers/user.service';
import { CreateInterviewDto } from '../dtos/create-interview.dto';
import { UpdateInterviewDto } from '../dtos/update-interview.dto';
import { SubmitInterviewDto } from '../dtos/submit-interview.dto';
import { AssignInterviewDto } from '../dtos/assign-interview.dto';
import { CancelInterviewDto } from '../dtos/cancel-interview.dto';
import { FinalizeInterviewDto } from '../dtos/finalize-interview.dto';
import { AssessmentSession } from 'src/common/typeorm/entities/assessment-session.entity';
import { SkillRating } from 'src/common/typeorm/entities/skill-rating.entity';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { PermissionsService } from 'src/common/policies/permissions.service';
import { UserPermissionEnum } from 'src/common/policies/user-permission.enum';
import { MailService } from 'src/common/mail/providers/mail.service';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import * as crypto from 'crypto';

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    @InjectRepository(JobRole)
    private readonly jobRoleRepo: Repository<JobRole>,
    @InjectRepository(AssessmentSession)
    private readonly assessmentSessionRepo: Repository<AssessmentSession>,
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
    private readonly activityService: ActivityService,
    private readonly permissionsService: PermissionsService,
    private readonly mailService: MailService,
  ) {}

  // A round is "outstanding" if it's been assigned but not yet resolved
  // (submitted or cancelled).
  private hasActiveRound(rounds: AssessmentSession[]): boolean {
    return rounds.some(
      (r) =>
        r.status === AssessmentSessionStatusEnum.ASSIGNED ||
        r.status === AssessmentSessionStatusEnum.STARTED,
    );
  }

  private hasStartedRound(rounds: AssessmentSession[]): boolean {
    return rounds.some((r) => r.status === AssessmentSessionStatusEnum.STARTED);
  }

  // Manager actions (update/assign/cancel) are only allowed before the SME has
  // taken (started) the current round — once STARTED, that round belongs to
  // the assessment flow, not the manager.
  private assertManagerCanModify(interview: Interview, rounds: AssessmentSession[]) {
    if (
      interview.status === InterviewStatusEnum.COMPLETED ||
      interview.status === InterviewStatusEnum.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot modify this interview because it is already ${interview.status.toLowerCase()}.`,
      );
    }

    if (this.hasStartedRound(rounds)) {
      throw new BadRequestException(
        'Cannot modify this interview while a round is in progress. Interview managers can only manage an interview before the SME takes it.',
      );
    }
  }

  // Users a manager can assign a round to — sourced for the assign-round SME
  // picker, since nothing else in the app exposes "who holds SME access."
  async getSmeDirectory() {
    return this.permissionsService.findUsersByPermissions([
      UserPermissionEnum.Sme,
      UserPermissionEnum.AssociateSme,
      UserPermissionEnum.SmeLead,
    ]);
  }

  async createInterview(dto: CreateInterviewDto) {
    const jobRole = await this.jobRoleRepo.findOne({
      where: { id: dto.jobRoleId },
    });

    if (!jobRole) {
      throw new NotFoundException('Invalid Job Role');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException(
        'Interview must be scheduled for a future date and time',
      );
    }

    let interviewCode = '';
    let attempts = 0;
    while (attempts < 5) {
      const generatedCode = crypto.randomBytes(5).toString('hex').toUpperCase();
      const existingInterview = await this.interviewRepo.findOne({
        where: { interviewCode: generatedCode },
      });

      if (!existingInterview) {
        interviewCode = generatedCode;
        break;
      }
      attempts++;
    }

    if (!interviewCode) {
      throw new ConflictException('Failed to generate a unique interview code');
    }

    const savedInterview = await this.dataSource.transaction(
      async (manager) => {
        let userId: number;

        if (dto.userId) {
          const user = await this.userService.findOne(dto.userId);
          if (!user) {
            throw new NotFoundException('User not found');
          }
          userId = user.id;
        } else {
          if (!dto.email || !dto.firstName) {
            throw new BadRequestException(
              'First name and email are required for new registrations',
            );
          }

          // A visitor filling in their own name/email may already have an
          // account (e.g. registered previously, or scheduled an earlier
          // interview) — reuse it instead of failing on the duplicate-email
          // check inside userService.create().
          const existingUser = await this.userService.findByEmail(dto.email);

          if (existingUser) {
            userId = existingUser.id;
          } else {
            const newUser = await this.userService.create({
              firstName: dto.firstName,
              lastName: dto.lastName,
              email: dto.email,
              mobile: dto.mobile,
              yearsExperience: dto.yearsExperience,
            });

            userId = newUser.id;
          }
        }

        const interview = manager.create(Interview, {
          title: dto.title,
          jobRoleId: dto.jobRoleId,
          scheduledAt,
          status: InterviewStatusEnum.SCHEDULED,
          interviewCode,
          userId,
        });

        const dbSavedInterview = await manager.save(Interview, interview);

        const historyLog = manager.create(InterviewStatusHistory, {
          interviewId: dbSavedInterview.id,
          oldStatus: dbSavedInterview.status,
          newStatus: dbSavedInterview.status,
          changedBy: userId,
          remarks: 'Interview scheduled successfully.',
        });

        await manager.save(InterviewStatusHistory, historyLog);

        return dbSavedInterview;
      },
    );

    try {
      await this.activityService.createActivity(
        savedInterview.userId,
        'Interview Scheduled',
        `Your interview "${savedInterview.title}" has been scheduled for ${savedInterview.scheduledAt.toLocaleString()}.`,
        savedInterview.interviewCode,
        'INTERVIEW',
      );
    } catch (activityError) {
      this.logger.error(
        'Failed to create interview scheduled activity',
        activityError instanceof Error
          ? activityError.stack
          : String(activityError),
      );
    }

    try {
      const candidate = await this.userService.findOne(savedInterview.userId);
      if (candidate) {
        await this.mailService.sendInterviewScheduledEmail(
          candidate.email,
          `${candidate.firstName} ${candidate.lastName ?? ''}`.trim(),
          savedInterview.title,
          savedInterview.scheduledAt.toLocaleString(),
        );
      }
    } catch (mailError) {
      this.logger.error(
        'Failed to send interview scheduled email',
        mailError instanceof Error ? mailError.stack : String(mailError),
      );
    }

    return savedInterview;
  }

  async updateInterview(
    interviewId: number,
    dto: UpdateInterviewDto,
    currentUserId: number,
  ) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
      relations: ['assessmentSessions'],
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${interviewId} not found`);
    }

    this.assertManagerCanModify(interview, interview.assessmentSessions ?? []);

    if (dto.title !== undefined) {
      interview.title = dto.title;
    }

    if (dto.jobRoleId !== undefined) {
      const jobRole = await this.jobRoleRepo.findOne({
        where: { id: dto.jobRoleId },
      });

      if (!jobRole) {
        throw new NotFoundException('Invalid Job Role');
      }

      interview.jobRoleId = dto.jobRoleId;
    }

    let isReschedule = false;
    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);

      if (scheduledAt <= new Date()) {
        throw new BadRequestException(
          'Interview must be scheduled for a future date and time',
        );
      }

      isReschedule = scheduledAt.getTime() !== interview.scheduledAt.getTime();
      interview.scheduledAt = scheduledAt;
    }

    const previousStatus = interview.status;

    const updatedInterview = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(Interview, interview);

      if (isReschedule) {
        // Status itself is left untouched — RESCHEDULED is recorded purely as
        // a history event marker.
        const historyLog = manager.create(InterviewStatusHistory, {
          interviewId: saved.id,
          oldStatus: previousStatus,
          newStatus: InterviewStatusEnum.RESCHEDULED,
          changedBy: currentUserId,
          remarks: `Rescheduled to ${saved.scheduledAt.toLocaleString()}.`,
        });
        await manager.save(InterviewStatusHistory, historyLog);
      }

      return saved;
    });

    if (isReschedule) {
      const candidate = await this.userService.findOne(updatedInterview.userId);
      if (candidate) {
        const candidateName = `${candidate.firstName} ${candidate.lastName ?? ''}`.trim();
        const scheduledAtText = updatedInterview.scheduledAt.toLocaleString();

        try {
          await this.activityService.createActivity(
            updatedInterview.userId,
            'Interview Rescheduled',
            `Your interview "${updatedInterview.title}" has been rescheduled to ${scheduledAtText}.`,
            updatedInterview.interviewCode,
            'INTERVIEW',
          );
        } catch (activityError) {
          this.logger.error(
            'Failed to create interview reschedule activity',
            activityError instanceof Error
              ? activityError.stack
              : String(activityError),
          );
        }

        try {
          await this.mailService.sendInterviewRescheduledEmail(
            candidate.email,
            candidateName,
            updatedInterview.title,
            scheduledAtText,
          );
        } catch (mailError) {
          this.logger.error(
            'Failed to send interview reschedule email',
            mailError instanceof Error ? mailError.stack : String(mailError),
          );
        }
      }
    }

    return updatedInterview;
  }

  // Assigns the NEXT round to an SME. Only allowed once any previous round has
  // been fully resolved (submitted or cancelled) — rounds are strictly
  // sequential.
  async assignInterview(
    interviewId: number,
    dto: AssignInterviewDto,
    currentUserId: number,
  ) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
      relations: ['assessmentSessions'],
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${interviewId} not found`);
    }

    const rounds = interview.assessmentSessions ?? [];
    this.assertManagerCanModify(interview, rounds);

    if (this.hasActiveRound(rounds)) {
      throw new BadRequestException(
        'A round is already assigned or in progress. It must be completed or cancelled before assigning a new one.',
      );
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException(
        'The round must be scheduled for a future date and time',
      );
    }

    const interviewer = await this.userService.findOne(dto.interviewerId);
    if (!interviewer) {
      throw new NotFoundException('Interviewer (SME) user not found');
    }

    const isSme =
      (await this.permissionsService.hasGlobalPermission(
        dto.interviewerId,
        UserPermissionEnum.Sme,
      )) ||
      (await this.permissionsService.hasGlobalPermission(
        dto.interviewerId,
        UserPermissionEnum.AssociateSme,
      )) ||
      (await this.permissionsService.hasGlobalPermission(
        dto.interviewerId,
        UserPermissionEnum.SmeLead,
      ));

    if (!isSme) {
      throw new BadRequestException(
        'Selected user does not hold SME access and cannot be assigned to an interview.',
      );
    }

    const roundNumber = rounds.length + 1;
    const previousStatus = interview.status;

    const { updatedInterview, round } = await this.dataSource.transaction(
      async (manager) => {
        // Raw parameterized SQL, bypassing TypeORM's entity/column metadata
        // entirely — neither manager.save() (with or without the relation
        // object set) nor manager.insert() reliably persist interviewId for
        // this entity; confirmed live that both silently write NULL despite
        // every other column (including the structurally similar
        // interviewerId FK) saving correctly. Root cause not fully isolated
        // (AssessmentSession redeclares the inherited `id` PK and has several
        // eager/cascade relations, any of which could be confusing TypeORM's
        // metadata for this one column) — raw SQL sidesteps it entirely
        // rather than continuing to guess at the ORM-level cause.
        interview.interviewerId = dto.interviewerId;
        interview.status = InterviewStatusEnum.IN_PROGRESS;
        const savedInterview = await manager.save(Interview, interview);

        const insertRs: { insertId: number } = await manager.query(
          `INSERT INTO assessment_session
             (userId, interviewId, interviewerId, ratingType, assessmentTitle, roundNumber, status, scheduledAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            interview.userId,
            interview.id,
            dto.interviewerId,
            RatingTypeEnum.INTERVIEW,
            `${interview.title} — Round ${roundNumber}`,
            roundNumber,
            AssessmentSessionStatusEnum.ASSIGNED,
            scheduledAt,
          ],
        );
        const newRoundId = insertRs.insertId;
        const savedRound = await manager.findOne(AssessmentSession, {
          where: { id: newRoundId },
        });

        const historyLog = manager.create(InterviewStatusHistory, {
          interviewId: savedInterview.id,
          assessmentSessionId: savedRound.id,
          oldStatus: previousStatus,
          newStatus: InterviewStatusEnum.IN_PROGRESS,
          changedBy: currentUserId,
          assignedToUserId: dto.interviewerId,
          remarks:
            dto.remarks?.trim() ||
            `Round ${roundNumber} assigned to ${interviewer.firstName} ${interviewer.lastName ?? ''}`.trim(),
        });
        await manager.save(InterviewStatusHistory, historyLog);

        return { updatedInterview: savedInterview, round: savedRound };
      },
    );

    const scheduledAtText = round.scheduledAt.toLocaleString();

    try {
      await this.activityService.createActivity(
        dto.interviewerId,
        'Interview Assigned',
        `You have been assigned to conduct round ${roundNumber} of "${updatedInterview.title}", scheduled for ${scheduledAtText}.`,
        updatedInterview.interviewCode,
        'INTERVIEW',
      );
    } catch (activityError) {
      this.logger.error(
        'Failed to create interview assignment activity',
        activityError instanceof Error
          ? activityError.stack
          : String(activityError),
      );
    }

    try {
      await this.mailService.sendInterviewAssignedEmail(
        interviewer.email,
        `${interviewer.firstName} ${interviewer.lastName ?? ''}`.trim(),
        updatedInterview.title,
        scheduledAtText,
      );
    } catch (mailError) {
      this.logger.error(
        'Failed to send interview assignment email',
        mailError instanceof Error ? mailError.stack : String(mailError),
      );
    }

    // The candidate previously wasn't told a round had even been scheduled,
    // let alone when or with whom — only the SME was notified.
    const candidate = await this.userService.findOne(updatedInterview.userId);
    if (candidate) {
      const candidateName = `${candidate.firstName} ${candidate.lastName ?? ''}`.trim();
      const interviewerName = `${interviewer.firstName} ${interviewer.lastName ?? ''}`.trim();

      try {
        await this.activityService.createActivity(
          candidate.id,
          'Interview Round Scheduled',
          `Round ${roundNumber} of your interview "${updatedInterview.title}" has been scheduled for ${scheduledAtText}.`,
          updatedInterview.interviewCode,
          'INTERVIEW',
        );
      } catch (activityError) {
        this.logger.error(
          'Failed to create candidate round-scheduled activity',
          activityError instanceof Error
            ? activityError.stack
            : String(activityError),
        );
      }

      try {
        await this.mailService.sendInterviewRoundScheduledEmail(
          candidate.email,
          candidateName,
          updatedInterview.title,
          roundNumber,
          scheduledAtText,
          interviewerName,
        );
      } catch (mailError) {
        this.logger.error(
          'Failed to send candidate round-scheduled email',
          mailError instanceof Error ? mailError.stack : String(mailError),
        );
      }
    }

    return { interview: updatedInterview, round };
  }

  // Cancels one specific pending (ASSIGNED, not yet STARTED) round — e.g. the
  // assigned SME can't make it — without affecting the rest of the interview.
  async cancelRound(
    interviewId: number,
    sessionId: number,
    dto: CancelInterviewDto,
    currentUserId: number,
  ) {
    const round = await this.assessmentSessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!round || round.interviewId !== interviewId) {
      throw new NotFoundException(
        `Round ${sessionId} not found on interview ${interviewId}`,
      );
    }

    if (round.status !== AssessmentSessionStatusEnum.ASSIGNED) {
      throw new BadRequestException(
        `Cannot cancel round ${round.roundNumber} because it is already ${round.status?.toLowerCase()}.`,
      );
    }

    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
      relations: ['assessmentSessions'],
    });

    const previousStatus = round.status;

    const updatedInterview = await this.dataSource.transaction(async (manager) => {
      round.status = AssessmentSessionStatusEnum.CANCELLED;
      round.declineReason = dto.declineReason;
      // update(), not save() — round.skillRatings was eager-loaded when
      // `round` was fetched above; save() cascades into that collection
      // (cascade: true) which can conflict with concurrent/stale state. See
      // the identical fix + explanation in submitInterview.
      await manager.update(AssessmentSession, round.id, {
        status: round.status,
        declineReason: round.declineReason,
      });

      // If no round has ever completed, this interview is effectively back to
      // square one — otherwise it stays IN_PROGRESS (earlier rounds happened).
      const otherRounds = (interview.assessmentSessions ?? []).filter(
        (r) => r.id !== round.id,
      );
      const everCompleted = otherRounds.some(
        (r) =>
          r.status === AssessmentSessionStatusEnum.COMPLETED ||
          r.status === AssessmentSessionStatusEnum.DECLINED,
      );
      interview.status = everCompleted
        ? InterviewStatusEnum.IN_PROGRESS
        : InterviewStatusEnum.SCHEDULED;
      const savedInterview = await manager.save(Interview, interview);

      const historyLog = manager.create(InterviewStatusHistory, {
        interviewId: savedInterview.id,
        assessmentSessionId: round.id,
        oldStatus: previousStatus,
        newStatus: AssessmentSessionStatusEnum.CANCELLED,
        changedBy: currentUserId,
        remarks: `Round ${round.roundNumber} cancelled: ${dto.declineReason}`,
      });
      await manager.save(InterviewStatusHistory, historyLog);

      return savedInterview;
    });

    // Previously nobody was told a round they were assigned to got pulled —
    // not even an in-app Activity, let alone an email.
    const interviewer = await this.userService.findOne(round.interviewerId);
    if (interviewer) {
      try {
        await this.activityService.createActivity(
          interviewer.id,
          'Interview Round Cancelled',
          `Round ${round.roundNumber} of "${updatedInterview.title}", which you were assigned to conduct, has been cancelled. Reason: ${dto.declineReason}`,
          updatedInterview.interviewCode,
          'INTERVIEW',
        );
      } catch (activityError) {
        this.logger.error(
          'Failed to create round-cancelled activity',
          activityError instanceof Error
            ? activityError.stack
            : String(activityError),
        );
      }

      try {
        await this.mailService.sendInterviewRoundCancelledEmail(
          interviewer.email,
          `${interviewer.firstName} ${interviewer.lastName ?? ''}`.trim(),
          updatedInterview.title,
          round.roundNumber,
          dto.declineReason,
        );
      } catch (mailError) {
        this.logger.error(
          'Failed to send round-cancelled email',
          mailError instanceof Error ? mailError.stack : String(mailError),
        );
      }
    }

    return { interview: updatedInterview, round };
  }

  // Cancels the WHOLE interview outright (candidate no-show, role closed,
  // etc.) — cascades to cancel any still-pending round. Callable by the
  // candidate who owns the interview (self-cancel) or an Interview Manager/
  // Admin — same "owner OR privileged" shape as getInterviewDetails.
  async cancelInterview(
    interviewId: number,
    dto: CancelInterviewDto,
    currentUser: { id: number; role: string },
  ) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
      relations: ['assessmentSessions'],
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${interviewId} not found`);
    }

    const isOwner = interview.userId === currentUser.id;
    const isPrivileged =
      currentUser.role === UserRoleEnum.ADMIN ||
      (await this.permissionsService.hasGlobalPermission(
        currentUser.id,
        UserPermissionEnum.InterviewManager,
      ));

    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException(
        'You do not have permission to cancel this interview.',
      );
    }

    const currentUserId = currentUser.id;
    const rounds = interview.assessmentSessions ?? [];
    this.assertManagerCanModify(interview, rounds);

    const previousStatus = interview.status;
    interview.status = InterviewStatusEnum.CANCELLED;
    interview.declineReason = dto.declineReason;
    interview.completedAt = null;

    const updatedInterview = await this.dataSource.transaction(async (manager) => {
      for (const round of rounds) {
        if (round.status === AssessmentSessionStatusEnum.ASSIGNED) {
          round.status = AssessmentSessionStatusEnum.CANCELLED;
          round.declineReason = 'Interview cancelled by manager.';
          // update(), not save() — see submitInterview for why.
          await manager.update(AssessmentSession, round.id, {
            status: round.status,
            declineReason: round.declineReason,
          });
        }
      }

      const saved = await manager.save(Interview, interview);

      const historyLog = manager.create(InterviewStatusHistory, {
        interviewId: saved.id,
        oldStatus: previousStatus,
        newStatus: InterviewStatusEnum.CANCELLED,
        changedBy: currentUserId,
        remarks: dto.declineReason,
      });
      await manager.save(InterviewStatusHistory, historyLog);

      return saved;
    });

    try {
      await this.activityService.createActivity(
        updatedInterview.userId,
        'Interview Cancelled',
        `Your interview "${updatedInterview.title}" was cancelled. Reason: ${updatedInterview.declineReason}`,
        updatedInterview.interviewCode,
        'INTERVIEW',
      );
    } catch (activityError) {
      this.logger.error(
        'Failed to create interview cancellation activity',
        activityError instanceof Error
          ? activityError.stack
          : String(activityError),
      );
    }

    try {
      const candidate = await this.userService.findOne(updatedInterview.userId);
      if (candidate) {
        await this.mailService.sendInterviewCancelledEmail(
          candidate.email,
          `${candidate.firstName} ${candidate.lastName ?? ''}`.trim(),
          updatedInterview.title,
          dto.declineReason,
        );
      }
    } catch (mailError) {
      this.logger.error(
        'Failed to send interview cancellation email',
        mailError instanceof Error ? mailError.stack : String(mailError),
      );
    }

    // Previously, if a candidate self-cancelled, the assigned SME (if any)
    // only found out by noticing it in the manager console. Notify them too.
    const activeRoundInterviewerIds = new Set(
      rounds
        .filter((r) => r.status === AssessmentSessionStatusEnum.ASSIGNED)
        .map((r) => r.interviewerId)
        .filter((id): id is number => id != null),
    );
    for (const interviewerId of activeRoundInterviewerIds) {
      const interviewer = await this.userService.findOne(interviewerId);
      if (!interviewer) continue;

      try {
        await this.activityService.createActivity(
          interviewer.id,
          'Interview Cancelled',
          `The interview "${updatedInterview.title}" you were assigned to has been cancelled. Reason: ${dto.declineReason}`,
          updatedInterview.interviewCode,
          'INTERVIEW',
        );
      } catch (activityError) {
        this.logger.error(
          'Failed to create SME interview-cancellation activity',
          activityError instanceof Error
            ? activityError.stack
            : String(activityError),
        );
      }

      try {
        await this.mailService.sendInterviewCancelledSmeNoticeEmail(
          interviewer.email,
          `${interviewer.firstName} ${interviewer.lastName ?? ''}`.trim(),
          updatedInterview.title,
          dto.declineReason,
        );
      } catch (mailError) {
        this.logger.error(
          'Failed to send SME interview-cancellation email',
          mailError instanceof Error ? mailError.stack : String(mailError),
        );
      }
    }

    return updatedInterview;
  }

  // Manager marks the whole interview process COMPLETED once satisfied with
  // however many rounds happened. Requires every round to be resolved
  // (nothing ASSIGNED/STARTED) and at least one round to have actually run.
  async finalizeInterview(
    interviewId: number,
    dto: FinalizeInterviewDto,
    currentUserId: number,
  ) {
    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
      relations: ['assessmentSessions'],
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${interviewId} not found`);
    }

    if (
      interview.status === InterviewStatusEnum.COMPLETED ||
      interview.status === InterviewStatusEnum.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot finalize this interview because it is already ${interview.status.toLowerCase()}.`,
      );
    }

    const rounds = interview.assessmentSessions ?? [];
    if (this.hasActiveRound(rounds)) {
      throw new BadRequestException(
        'Cannot finalize while a round is still assigned or in progress.',
      );
    }

    const hasResolvedRound = rounds.some(
      (r) =>
        r.status === AssessmentSessionStatusEnum.COMPLETED ||
        r.status === AssessmentSessionStatusEnum.DECLINED,
    );
    if (!hasResolvedRound) {
      throw new BadRequestException(
        'At least one round must be completed before finalizing this interview.',
      );
    }

    const previousStatus = interview.status;
    interview.status = InterviewStatusEnum.COMPLETED;
    interview.completedAt = new Date();
    if (dto.feedback !== undefined) {
      interview.feedback = dto.feedback;
    }

    const updatedInterview = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(Interview, interview);

      const historyLog = manager.create(InterviewStatusHistory, {
        interviewId: saved.id,
        oldStatus: previousStatus,
        newStatus: InterviewStatusEnum.COMPLETED,
        changedBy: currentUserId,
        remarks: dto.feedback ?? 'Interview finalized by manager.',
      });
      await manager.save(InterviewStatusHistory, historyLog);

      return saved;
    });

    try {
      await this.activityService.createActivity(
        updatedInterview.userId,
        'Interview Completed',
        `Your interview "${updatedInterview.title}" has been completed and reviewed.`,
        updatedInterview.interviewCode,
        'INTERVIEW',
      );
    } catch (activityError) {
      this.logger.error(
        'Failed to create interview finalization activity',
        activityError instanceof Error
          ? activityError.stack
          : String(activityError),
      );
    }

    try {
      const candidate = await this.userService.findOne(updatedInterview.userId);
      if (candidate) {
        await this.mailService.sendInterviewCompletedEmail(
          candidate.email,
          `${candidate.firstName} ${candidate.lastName ?? ''}`.trim(),
          updatedInterview.title,
          updatedInterview.feedback,
        );
      }
    } catch (mailError) {
      this.logger.error(
        'Failed to send interview finalization email',
        mailError instanceof Error ? mailError.stack : String(mailError),
      );
    }

    return updatedInterview;
  }

  async startInterview(
    interviewId: number,
    sessionId: number,
    currentUserId: number,
  ) {
    const round = await this.assessmentSessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!round || round.interviewId !== interviewId) {
      throw new NotFoundException(
        `Round ${sessionId} not found on interview ${interviewId}`,
      );
    }

    if (round.status !== AssessmentSessionStatusEnum.ASSIGNED) {
      throw new BadRequestException(
        `Round must be ${AssessmentSessionStatusEnum.ASSIGNED} to be started (currently ${round.status}).`,
      );
    }

    if (round.interviewerId !== currentUserId) {
      throw new BadRequestException(
        'Only the assigned interviewer can start this round.',
      );
    }

    const previousStatus = round.status;
    round.status = AssessmentSessionStatusEnum.STARTED;
    round.startedAt = new Date();

    const updatedRound = await this.dataSource.transaction(async (manager) => {
      // update(), not save() — see submitInterview for why.
      await manager.update(AssessmentSession, round.id, {
        status: round.status,
        startedAt: round.startedAt,
      });
      const saved = round;

      const historyLog = manager.create(InterviewStatusHistory, {
        interviewId,
        assessmentSessionId: saved.id,
        oldStatus: previousStatus,
        newStatus: AssessmentSessionStatusEnum.STARTED,
        changedBy: currentUserId,
        remarks: `Round ${saved.roundNumber} started.`,
      });
      await manager.save(InterviewStatusHistory, historyLog);

      return saved;
    });

    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId },
    });

    return { interview, round: updatedRound };
  }

  // Minimum distinct skill ratings required to mark a round COMPLETED — centralized here so the
  // bar is trivial to retune. DECLINED (integrity issue found mid-round) isn't held to this bar;
  // the interviewer may bail out before rating anyone.
  private static readonly MIN_SKILL_RATINGS_TO_COMPLETE = 3;

  private validateSubmitInterviewDto(dto: SubmitInterviewDto): void {
    if (!dto.skillRatings || !Array.isArray(dto.skillRatings)) {
      throw new BadRequestException(
        'Interview submission must include a skillRatings array.',
      );
    }

    if (
      dto.status !== AssessmentSessionStatusEnum.COMPLETED &&
      dto.status !== AssessmentSessionStatusEnum.DECLINED
    ) {
      throw new BadRequestException(
        'Submission status must be COMPLETED or DECLINED.',
      );
    }

    if (
      dto.status === AssessmentSessionStatusEnum.COMPLETED &&
      dto.skillRatings.length < InterviewService.MIN_SKILL_RATINGS_TO_COMPLETE
    ) {
      throw new BadRequestException(
        `At least ${InterviewService.MIN_SKILL_RATINGS_TO_COMPLETE} skill ratings are required to complete a round.`,
      );
    }

    if (
      dto.status === AssessmentSessionStatusEnum.DECLINED &&
      !dto.declineReason?.trim()
    ) {
      throw new BadRequestException(
        'A clear decline reason must be specified when rejecting an interview.',
      );
    }
  }

  async submitInterview(
    interviewId: number,
    sessionId: number,
    dto: SubmitInterviewDto,
    currentUserId: number,
  ) {
    this.validateSubmitInterviewDto(dto);

    const round = await this.assessmentSessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!round || round.interviewId !== interviewId) {
      throw new NotFoundException(
        `Round ${sessionId} not found on interview ${interviewId}`,
      );
    }

    if (round.status !== AssessmentSessionStatusEnum.STARTED) {
      throw new BadRequestException(
        `Round must be started before it can be submitted (currently ${round.status}).`,
      );
    }

    if (round.interviewerId !== currentUserId) {
      throw new BadRequestException(
        'Only the assigned interviewer can submit this round.',
      );
    }

    const interview = await this.interviewRepo.findOne({
      where: { id: round.interviewId },
    });
    if (!interview) {
      throw new NotFoundException(
        `Interview for round ${round.id} not found`,
      );
    }

    const updatedRound = await this.dataSource.transaction(async (manager) => {
      // Raw insert, not manager.save() with entity instances — `round` below
      // was fetched with its (eager, cascade:true) skillRatings collection
      // already loaded from a prior state; saving the AssessmentSession
      // entity later in this same transaction would cascade into that stale
      // collection and conflict with the rows inserted here. insert() only
      // touches skill_rating directly.
      for (const item of dto.skillRatings) {
        await manager.insert(SkillRating, {
          skillId: item.skillId,
          skillType: item.skillType,
          rating: item.rating,
          ratingType: RatingTypeEnum.INTERVIEW,
          assessmentSessionId: round.id,
        });
      }

      const previousStatus = round.status;
      round.status = dto.status;
      round.ratedBy = currentUserId;
      round.completedAt = new Date();
      round.feedback = dto.feedback ?? null;
      round.declineReason =
        dto.status === AssessmentSessionStatusEnum.DECLINED
          ? dto.declineReason
          : null;

      // update(), not save() — round.skillRatings is still the stale array
      // eager-loaded when `round` was fetched above; save() would cascade
      // into that collection (cascade: true) and conflicts with the fresh
      // ratings just inserted. update() only touches the columns given.
      await manager.update(AssessmentSession, round.id, {
        status: round.status,
        ratedBy: round.ratedBy,
        completedAt: round.completedAt,
        feedback: round.feedback,
        declineReason: round.declineReason,
      });
      const savedRound = round;

      const historyLog = manager.create(InterviewStatusHistory, {
        interviewId: interview.id,
        assessmentSessionId: savedRound.id,
        oldStatus: previousStatus,
        newStatus: dto.status,
        changedBy: currentUserId,
        remarks: `Round ${savedRound.roundNumber} submitted.`,
      });
      await manager.save(InterviewStatusHistory, historyLog);

      return savedRound;
    });

    try {
      const isCompleted = updatedRound.status === AssessmentSessionStatusEnum.COMPLETED;
      const activityTitle = isCompleted
        ? 'Interview Round Completed'
        : 'Interview Round Declined';
      const activityMessage = isCompleted
        ? `Round ${updatedRound.roundNumber} of your interview "${interview.title}" has been completed and reviewed.`
        : `Round ${updatedRound.roundNumber} of your interview "${interview.title}" was marked as declined. Reason: ${updatedRound.declineReason}`;

      await this.activityService.createActivity(
        interview.userId,
        activityTitle,
        activityMessage,
        interview.interviewCode,
        'INTERVIEW',
      );
    } catch (activityError) {
      this.logger.error(
        'Failed to create round submission activity',
        activityError instanceof Error
          ? activityError.stack
          : String(activityError),
      );
    }

    try {
      const candidate = await this.userService.findOne(interview.userId);
      if (candidate) {
        const candidateName = `${candidate.firstName} ${candidate.lastName ?? ''}`.trim();

        if (updatedRound.status === AssessmentSessionStatusEnum.COMPLETED) {
          await this.mailService.sendInterviewRoundCompletedEmail(
            candidate.email,
            candidateName,
            interview.title,
            updatedRound.roundNumber,
            updatedRound.feedback,
          );
        } else {
          await this.mailService.sendInterviewRoundDeclinedEmail(
            candidate.email,
            candidateName,
            interview.title,
            updatedRound.roundNumber,
            updatedRound.declineReason,
          );
        }
      }
    } catch (mailError) {
      this.logger.error(
        'Failed to send round submission email',
        mailError instanceof Error ? mailError.stack : String(mailError),
      );
    }

    return { interview, round: updatedRound };
  }

  async getInterviewDetails(
    interviewCode: string,
    currentUser: { id: number; role: string },
  ) {
    const interview = await this.interviewRepo
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.user', 'user')
      .leftJoinAndSelect('interview.jobRole', 'jobRole')
      .leftJoinAndSelect('interview.interviewer', 'interviewer')
      .leftJoinAndSelect('interview.assessmentSessions', 'assessmentSession')
      .leftJoinAndSelect('assessmentSession.skillRatings', 'skillRating')
      .leftJoinAndSelect('assessmentSession.interviewer', 'roundInterviewer')
      .leftJoinAndSelect('interview.statusHistory', 'statusHistory')
      .leftJoinAndSelect('statusHistory.assignedTo', 'assignedTo')
      .leftJoinAndSelect('statusHistory.changedByUser', 'changedByUser')
      .where('interview.interviewCode = :interviewCode', {
        interviewCode,
      })
      .orderBy('assessmentSession.roundNumber', 'ASC')
      .addOrderBy('statusHistory.createdAt', 'DESC')
      .getOne();

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    const rounds = interview.assessmentSessions ?? [];
    const isOwner =
      interview.userId === currentUser.id ||
      interview.interviewerId === currentUser.id ||
      rounds.some((r) => r.interviewerId === currentUser.id);
    const isPrivileged =
      currentUser.role === UserRoleEnum.ADMIN ||
      (await this.permissionsService.hasGlobalPermission(
        currentUser.id,
        UserPermissionEnum.InterviewManager,
      ));

    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException(
        'You do not have permission to view this interview report.',
      );
    }

    return interview;
  }

  async getInterviews(
    userId?: number,
    fetchAll?: boolean,
    interviewerId?: number,
    when?: 'upcoming' | 'past',
    status?: string,
  ) {
    const query = this.interviewRepo
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.user', 'user')
      .leftJoinAndSelect('interview.jobRole', 'jobRole')
      .leftJoinAndSelect('interview.interviewer', 'interviewer')
      // Round data is included on every list response (not just the detail
      // endpoint) — otherwise an SME's "pending queue" response wouldn't say
      // which round/date matched, forcing a second call per row to find out.
      .leftJoinAndSelect('interview.assessmentSessions', 'assessmentSession');

    if (interviewerId) {
      // "Assigned to me" means: I hold a round on this interview — checked
      // against AssessmentSession, not just the denormalized current pointer,
      // so past rounds by this SME on a now-multi-round interview still match.
      // A separate join alias from the leftJoinAndSelect above: this one is
      // purely for filtering (WHERE), it doesn't affect what's selected.
      query
        .innerJoin('interview.assessmentSessions', 'myRound')
        .andWhere('myRound.interviewerId = :interviewerId', { interviewerId });

      if (status) {
        query.andWhere('myRound.status = :roundStatus', { roundStatus: status });
      }
    } else {
      if (!fetchAll && userId) {
        query.andWhere('interview.userId = :userId', { userId });
      }

      if (status) {
        query.andWhere('interview.status = :status', { status });
      }
    }

    if (when === 'upcoming') {
      query.andWhere('interview.scheduledAt >= :now', { now: new Date() });
      query.orderBy('interview.scheduledAt', 'ASC');
    } else if (when === 'past') {
      query.andWhere('interview.scheduledAt < :now', { now: new Date() });
      query.orderBy('interview.scheduledAt', 'DESC');
    }

    // addOrderBy (not orderBy) — appends as a secondary key so it composes
    // with whichever primary sort was set above instead of overwriting it.
    query.addOrderBy('assessmentSession.roundNumber', 'ASC');

    return await query.getMany();
  }
}
