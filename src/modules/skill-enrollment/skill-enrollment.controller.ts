import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse as ApiResponseDoc,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/core/auth/jwt/optional-jwt-auth-guard';
import { Roles } from 'src/core/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/core/auth/guards/roles.guard';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { ApiResponse } from 'src/common/utils/api-response';
import { EnrollmentStatusEnum } from 'src/common/enum/enrollment-status.enum';
import { GrantEnrollmentDto } from './dtos/grant-enrollment.dto';
import { RevokeEnrollmentDto } from './dtos/revoke-enrollment.dto';
import { EnrollBasicDto } from './dtos/enroll-basic.dto';
import { EnrollBasicBatchDto } from './dtos/enroll-basic-batch.dto';
import { UpsertTierOfferingDto } from './dtos/upsert-tier-offering.dto';
import { BatchUpsertTierOfferingsDto } from './dtos/batch-upsert-tier-offerings.dto';
import { BatchDeactivateTierOfferingsDto } from './dtos/batch-deactivate-tier-offerings.dto';
import { UpdateTierCapConfigDto } from './dtos/update-tier-cap-config.dto';
import { SetSubjectPremiumFlagDto } from './dtos/set-subject-premium-flag.dto';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';
import { SkillEnrollmentService } from './providers/skill-enrollment.service';

// Shared by every batch endpoint below that takes a comma-separated id list —
// invalid/non-positive entries are silently dropped rather than 400ing, since these
// are always machine-built query strings (master data ids), not raw user input.
function parseIdList(raw: string): number[] {
  return Array.from(
    new Set(
      String(raw ?? '')
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
}

@ApiTags('Skill Enrollment')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@Controller('apis/enrollments')
export class SkillEnrollmentController {
  constructor(private readonly service: SkillEnrollmentService) {}

  @ApiOperation({
    summary: 'Enroll in the free Basic plan for a subject (self-serve, no checkout)',
    description:
      'Any logged-in user, any subject — Basic needs no SkillTierOffering, every ' +
      'subject is Basic-eligible unconditionally. No payment, no admin approval. The ' +
      'resulting enrollment never expires. 409 if the caller already has an active ' +
      'enrollment (Basic or otherwise) for this subject. **Required before any quiz/' +
      'lesson access on a premium subject** — without an explicit enrollment (Basic ' +
      'or higher), a premium subject is fully locked; only non-premium ' +
      '(`isPremium: false`) subjects are open with no enrollment at all.',
  })
  @ApiResponseDoc({ status: 404, description: 'No subject exists with the given id.' })
  @ApiResponseDoc({
    status: 409,
    description: 'Caller already has an active enrollment (any tier) for this subject.',
  })
  @Post('enroll-basic')
  async enrollBasic(
    @Body() dto: EnrollBasicDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.enrollBasic(req.user.id, dto.subjectId);
    return new ApiResponse('Enrolled in the Basic plan successfully.', result);
  }

  @ApiOperation({
    summary: 'Enroll in the free Basic plan for several subjects in one action',
    description:
      'Any logged-in user. The same endpoint whether you\'re enrolling in "all of a ' +
      'job role\'s subjects" or a hand-picked subset — just send that subject-id ' +
      'list. Skip-and-proceed: a subject that doesn\'t exist, or where you already ' +
      'hold any active enrollment, is dropped from the batch rather than failing the ' +
      'whole request — the response always lists what was actually enrolled vs. ' +
      'skipped and why. `batch` is `null` if every requested subject was skipped ' +
      '(nothing was created). `jobRoleId` is optional, opaque provenance only.',
  })
  @Post('enroll-basic/batch')
  async enrollBasicBatch(
    @Body() dto: EnrollBasicBatchDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.enrollBasicBatch(
      req.user.id,
      dto.subjectIds,
      dto.jobRoleId,
    );
    return new ApiResponse('Basic batch enrollment processed successfully.', result);
  }

  @ApiOperation({
    summary: "List the caller's own multi-subject enrollment actions (batches)",
    description:
      'Newest first, each with the subjects actually enrolled under it so far. A ' +
      'Pending/Failed paid batch shows an empty `items` list until its webhook ' +
      'fulfills at least one subject — check GET /apis/payments/orders/me for the ' +
      'underlying payment attempt in the meantime.',
  })
  @Get('batches/me')
  async listMyBatches(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.service.listMyBatches(req.user.id);
    return new ApiResponse('Your enrollment batches fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Grant a Subject enrollment at a specific tier (Admin only)',
    description:
      'Admin-only — there is no payment gateway wired up yet, so this is the manual ' +
      'stand-in a future purchase-success webhook will call for paid tiers. `tier` ' +
      'can be Basic too (though users normally self-serve that via `enroll-basic`) — ' +
      'paid tiers (Curious/Pro/Intern/Serious) require the subject to have an active ' +
      'SkillTierOffering for it (400 otherwise); Basic never does. Access window ' +
      'defaults per-tier (Basic never expires). 409 if the user already has an active ' +
      'enrollment for this subject — revoke it first to change tiers.',
  })
  @ApiResponseDoc({ status: 404, description: 'No subject exists with the given id.' })
  @ApiResponseDoc({
    status: 400,
    description: 'The subject does not offer the given tier (Basic is exempt from this check).',
  })
  @ApiResponseDoc({
    status: 409,
    description: 'The user already has an active enrollment for this subject.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Post('grant')
  async grant(
    @Body() dto: GrantEnrollmentDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.grantEnrollment(dto, req.user.id);
    return new ApiResponse('Enrollment granted successfully.', result);
  }

  @ApiOperation({
    summary: 'Revoke/cancel an enrollment (Admin only)',
    description:
      'Sets the enrollment to Cancelled with an optional reason and timestamp — a hard ' +
      'stop on access for that subject, not a refund action in itself. Does not delete ' +
      'the row; it stays visible in listMine()/listAll() for history.',
  })
  @ApiParam({ name: 'id', description: 'SkillEnrollment id to revoke.', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No enrollment exists with the given id.' })
  @ApiResponseDoc({ status: 409, description: 'The enrollment is already cancelled.' })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Post(':id/revoke')
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevokeEnrollmentDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.revokeEnrollment(id, dto.reason);
    return new ApiResponse('Enrollment revoked successfully.', result);
  }

  @ApiOperation({
    summary: "List the caller's own enrollments",
  })
  @Get('me')
  async listMine(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.service.listMine(req.user.id);
    return new ApiResponse('Your enrollments fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'List all enrollments (Admin only)',
    description: 'Every SkillEnrollment row across every user, newest first, with the resolved subject name and current-active flag attached. Optionally filtered.',
  })
  @ApiQuery({ name: 'userId', required: false, type: Number, description: 'Only this user\'s enrollments.' })
  @ApiQuery({ name: 'status', required: false, enum: EnrollmentStatusEnum, description: 'Only enrollments in this status.' })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Get()
  async listAll(
    @Query('userId') userId?: string,
    @Query('status') status?: EnrollmentStatusEnum,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.listAll({
      userId: userId ? Number(userId) : undefined,
      status,
    });
    return new ApiResponse('Enrollments fetched successfully.', result);
  }

  @ApiOperation({
    summary: "Check the caller's tier for a subject (public — personalized when logged in)",
    description:
      'Returns the caller\'s current tier (basic/curious/pro/intern/serious), whether ' +
      'the subject is premium, and every tier the subject actually offers for ' +
      'purchase (basic is always included). `tier: null` means not enrolled at all — ' +
      'zero access on a premium subject. Anonymous callers are always `null` on a ' +
      'premium subject (enrollment requires an account), unaffected on a non-premium one.',
  })
  @ApiParam({ name: 'subjectId', description: 'Subject id to check access for.', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No subject exists with the given id.' })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('access/subject/:subjectId')
  async subjectAccess(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.getSubjectAccessInfo(req.user?.id, subjectId);
    return new ApiResponse('Subject access checked successfully.', result);
  }

  @ApiOperation({
    summary: "Check the caller's tier across several subjects at once (public — personalized when logged in)",
    description:
      'Batch counterpart to GET access/subject/:subjectId — same per-item shape, one ' +
      'HTTP round trip instead of one per subject. Built for the job-role subject ' +
      'picker/enrollment-panel summary, which needs this for every subject a role ' +
      'covers. Unknown subject ids are silently dropped rather than erroring.',
  })
  @ApiQuery({
    name: 'subjectIds',
    required: true,
    type: String,
    description: 'Comma-separated subject ids, e.g. "3,7,12". Invalid/non-positive ids are silently dropped.',
  })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('access/subjects')
  async subjectAccessBatch(
    @Query('subjectIds') subjectIds: string,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.getSubjectAccessInfoBatch(req.user?.id, parseIdList(subjectIds));
    return new ApiResponse('Subject access checked successfully.', result);
  }

  @ApiOperation({
    summary: "Browse a job role's subjects with the caller's tier on each (public — personalized when logged in, read-only)",
    description:
      'Job roles are not an enrollment scope — there is no "enroll in this job role" ' +
      'action. This is a pure browsing view: every subject the role covers (via ' +
      'JobRoleSubject) with the caller\'s independently-held tier on each (null if not ' +
      'enrolled in that specific subject). To gain access, enroll in the individual ' +
      'subjects that make up the role.',
  })
  @ApiParam({ name: 'jobRoleId', description: 'Job role id to browse.', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No job role exists with the given id.' })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('job-role/:jobRoleId/subjects')
  async jobRoleSubjects(
    @Param('jobRoleId', ParseIntPipe) jobRoleId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.getJobRoleSubjectsBreakdown(req.user?.id, jobRoleId);
    return new ApiResponse('Job role subjects fetched successfully.', result);
  }

  // ---------------------------------------------------------------------------
  // Tier offerings — which tiers a subject sells (Admin only to manage)
  // ---------------------------------------------------------------------------

  @ApiOperation({
    summary: 'Declare (or update) a tier a subject offers (Admin only)',
    description:
      'Creates the offering if none exists for this (subject, tier), otherwise ' +
      'updates its price/duration overrides and reactivates it. Basic cannot be ' +
      'declared — it\'s universal. Price/duration omitted falls back to the tier\'s default.',
  })
  @ApiResponseDoc({ status: 404, description: 'No subject exists with the given id.' })
  @ApiResponseDoc({
    status: 400,
    description: 'Basic was given as the tier — it is universal/implicit and cannot be declared as an offering.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Post('tier-offerings')
  async upsertTierOffering(
    @Body() dto: UpsertTierOfferingDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.upsertTierOffering(dto, req.user.id);
    return new ApiResponse('Tier offering saved successfully.', result);
  }

  @ApiOperation({
    summary: 'Deactivate a tier offering (Admin only)',
    description: 'Existing enrollments at this tier are unaffected — this only blocks new grants/purchases.',
  })
  @ApiParam({ name: 'id', description: 'SkillTierOffering id to deactivate.', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No tier offering exists with the given id.' })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Post('tier-offerings/:id/deactivate')
  async deactivateTierOffering(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.deactivateTierOffering(id);
    return new ApiResponse('Tier offering deactivated successfully.', result);
  }

  @ApiOperation({
    summary: 'Declare (or update) tiers for many subjects at once (Admin only)',
    description:
      'Cross-product of subjectIds x tiers — same upsert semantics as the single-item ' +
      "endpoint above, just batched. This is how a new subject's full paid ladder gets " +
      'set up in one call instead of one per tier. A subjectId that does not exist, or ' +
      "a Basic entry in tiers (it's universal, can't be declared), is skipped and " +
      'reported in `skipped[]` rather than failing the whole batch. Price/duration ' +
      'overrides (if given) apply uniformly to every pair — for a different override ' +
      'per pair, use the single-item endpoint instead.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Post('tier-offerings/batch')
  async batchUpsertTierOfferings(
    @Body() dto: BatchUpsertTierOfferingsDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.batchUpsertTierOfferings(dto, req.user.id);
    return new ApiResponse('Tier offerings saved successfully.', result);
  }

  @ApiOperation({
    summary: 'Deactivate tiers for many subjects at once (Admin only)',
    description:
      'Cross-product of subjectIds x tiers — the batch counterpart to ' +
      '`POST tier-offerings/:id/deactivate`. A pair with no offering row, or one ' +
      'already inactive, is skipped and reported rather than failing the batch. ' +
      'Existing enrollments at a deactivated tier are unaffected — this only blocks ' +
      'new grants/purchases.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Post('tier-offerings/batch/deactivate')
  async batchDeactivateTierOfferings(
    @Body() dto: BatchDeactivateTierOfferingsDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.batchDeactivateTierOfferings(dto);
    return new ApiResponse('Tier offerings deactivated successfully.', result);
  }

  @ApiOperation({
    summary: 'List tier offerings across several subjects at once (Admin only)',
    description:
      'Includes inactive offerings too (unlike the public per-subject endpoint below, ' +
      'which only shows what\'s currently purchasable) — what a "manage plans" admin ' +
      'screen needs to render a subject x tier grid without one request per subject.',
  })
  @ApiQuery({
    name: 'subjectIds',
    required: true,
    type: String,
    description: 'Comma-separated subject ids, e.g. "3,7,12". Invalid/non-positive ids are silently dropped.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Get('tier-offerings/manage')
  async listTierOfferingsForSubjects(
    @Query('subjectIds') subjectIds: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.listTierOfferingsForSubjects(parseIdList(subjectIds));
    return new ApiResponse('Tier offerings fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'List active tier offerings for a subject (public)',
    description: 'What a frontend needs to render "available plans" on a subject page.',
  })
  @ApiParam({ name: 'subjectId', description: 'Subject id to list offerings for.', type: Number })
  @Public()
  @Get('tier-offerings/subject/:subjectId')
  async listTierOfferings(
    @Param('subjectId', ParseIntPipe) subjectId: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.listTierOfferings(subjectId);
    return new ApiResponse('Tier offerings fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'List active tier offerings across several subjects at once (public)',
    description:
      'Batch counterpart to GET tier-offerings/subject/:subjectId — active rows only, ' +
      'one HTTP round trip instead of one per subject. Built for the job-role subject ' +
      'picker/enrollment-panel summary alongside access/subjects above.',
  })
  @ApiQuery({
    name: 'subjectIds',
    required: true,
    type: String,
    description: 'Comma-separated subject ids, e.g. "3,7,12". Invalid/non-positive ids are silently dropped.',
  })
  @Public()
  @Get('tier-offerings/subjects')
  async listTierOfferingsBatch(
    @Query('subjectIds') subjectIds: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.listTierOfferingsForSubjectsPublic(parseIdList(subjectIds));
    return new ApiResponse('Tier offerings fetched successfully.', result);
  }

  // ---------------------------------------------------------------------------
  // Subject.isPremium — the per-subject "free showcase" escape hatch (Admin only)
  // ---------------------------------------------------------------------------

  @ApiOperation({
    summary: "Set a subject's premium flag (Admin only)",
    description:
      'false makes the subject fully open — unlimited lessons and quizzes for ' +
      'everyone at any tier, including anonymous visitors. true (the default for ' +
      'every subject) means Basic/Curious are capped there per the normal tier rules. ' +
      'This is the only way to make a subject a free showcase — there is no hardcoded ' +
      'exemption list anymore.',
  })
  @ApiParam({ name: 'subjectId', description: 'Subject id to update.', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No subject exists with the given id.' })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Post('subjects/:subjectId/premium-flag')
  async setSubjectPremiumFlag(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Body() dto: SetSubjectPremiumFlagDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.setSubjectPremiumFlag(subjectId, dto.isPremium);
    return new ApiResponse('Subject premium flag updated successfully.', result);
  }

  // ---------------------------------------------------------------------------
  // Tier daily-cap config (Admin only)
  // ---------------------------------------------------------------------------

  @ApiOperation({
    summary: 'List configured daily caps per tier (Admin only)',
    description: 'A tier with no row falls back to a hardcoded default — see skill-enrollment.constants.ts.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Get('tier-caps')
  async listTierCapConfigs(): Promise<ApiResponse<any>> {
    const result = await this.service.listTierCapConfigs();
    return new ApiResponse('Tier cap config fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Set the daily quiz/lesson caps for a tier (Admin only)',
    description: 'Only meaningful for Basic/Curious — Pro/Intern/Serious are always unlimited regardless of any row here.',
  })
  @ApiParam({ name: 'tier', description: 'Tier to configure.', enum: EnrollmentTierEnum })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Post('tier-caps/:tier')
  async upsertTierCapConfig(
    @Param('tier') tier: EnrollmentTierEnum,
    @Body() dto: UpdateTierCapConfigDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.upsertTierCapConfig(
      tier,
      dto.dailyQuizCap,
      dto.dailyLessonCap,
    );
    return new ApiResponse('Tier cap config saved successfully.', result);
  }
}
