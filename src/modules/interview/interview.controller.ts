import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiResponse } from 'src/common/utils/api-response';
import { CreateInterviewDto } from './dtos/create-interview.dto';
import { InterviewService } from './providers/interview.service';
import {
  Put,
  Get,
  Param,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { UpdateInterviewDto } from './dtos/update-interview.dto';
import { SubmitInterviewDto } from './dtos/submit-interview.dto';
import { AssignInterviewDto } from './dtos/assign-interview.dto';
import { CancelInterviewDto } from './dtos/cancel-interview.dto';
import { FinalizeInterviewDto } from './dtos/finalize-interview.dto';
import { InterviewManagerGuard } from 'src/common/policies/interview-manager.guard';
import { OptionalJwtAuthGuard } from 'src/core/auth/jwt/optional-jwt-auth-guard';
import { Public } from 'src/core/auth/decorators/public.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';

@ApiTags('Interviews')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@Controller('apis/interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @ApiOperation({
    summary: 'Schedule an interview (public — no login required)',
    description:
      'Books a candidate for a job role at a preferred date/time. Provide `userId` for an ' +
      'existing account, or `firstName`+`email` (+ optional `lastName`/`mobile`/`yearsExperience`) ' +
      'to register a new one — if that email already has an account, it is silently reused instead ' +
      'of erroring. Rejects with 400 if the candidate already has another active interview ' +
      '(any status except CANCELLED/COMPLETED) whose window overlaps this request.',
  })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async createInterview(
    @Body() dto: CreateInterviewDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.createInterview(dto);

    return new ApiResponse('Interview created successfully', result);
  }

  @ApiOperation({
    summary: "Update an interview's title/job role/date (Interview Manager only)",
    description:
      'Blocked once any round has been STARTED, or the interview is COMPLETED/CANCELLED. ' +
      'Rescheduling `scheduledAt` runs the same overlap check as create (400 if it now clashes with ' +
      "another of this candidate's active interviews). This edits the candidate's preference only — " +
      "it does not move an already-assigned round's own time; cancel and reassign that instead.",
  })
  @ApiParam({ name: 'id', description: 'Interview id', type: Number })
  @UseGuards(InterviewManagerGuard)
  @Put(':id')
  async updateInterview(
    @Param('id', ParseIntPipe) interviewId: number, // Explicit variable name
    @Body() dto: UpdateInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.updateInterview(
      interviewId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Interview updated successfully', result);
  }

  @ApiOperation({
    summary: 'Assign the next round to an SME (Interview Manager only)',
    description:
      'Only allowed once any previous round is fully resolved (rounds are strictly sequential). ' +
      "Validates the target holds an SME permission tier. Rejects with 400 if the window " +
      "[`scheduledAt`, `scheduledAt`+`durationMinutes`) overlaps another live (ASSIGNED/STARTED) " +
      "round for either the SME or the candidate, across all of their interviews. Notifies the SME " +
      "(in-app + email) and the candidate (in-app + email, told who's interviewing them and when).",
  })
  @ApiParam({ name: 'id', description: 'Interview id', type: Number })
  @UseGuards(InterviewManagerGuard)
  @Put(':id/assign')
  async assignInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Body() dto: AssignInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.assignInterview(
      interviewId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Round assigned successfully', result);
  }

  @ApiOperation({
    summary: 'Cancel one pending round, before the SME starts it (Interview Manager only)',
    description:
      'Only allowed while this specific round is still ASSIGNED (not yet STARTED). Lets a manager ' +
      'swap in a different SME for the same round without affecting the rest of the interview. ' +
      "Notifies the round's SME (in-app + email). If no round on this interview has ever completed, " +
      "the interview's overall status reverts to SCHEDULED; otherwise it stays IN_PROGRESS.",
  })
  @ApiParam({ name: 'id', description: 'Interview id', type: Number })
  @ApiParam({ name: 'sessionId', description: 'AssessmentSession (round) id', type: Number })
  @UseGuards(InterviewManagerGuard)
  @Put(':id/rounds/:sessionId/cancel')
  async cancelRound(
    @Param('id', ParseIntPipe) interviewId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: CancelInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.cancelRound(
      interviewId,
      sessionId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Round cancelled successfully', result);
  }

  @ApiOperation({
    summary: 'Cancel the whole interview outright — self-service or manager',
    description:
      'Callable by the candidate who owns the interview (self-cancel) OR an Interview Manager/Admin ' +
      '— 403 for anyone else. Blocked once any round has been STARTED, or the interview is already ' +
      'COMPLETED/CANCELLED. Cascades to cancel any still-ASSIGNED round. Notifies the candidate ' +
      "(in-app + email) and, if a round was actively assigned, that round's SME too (in-app + email) " +
      "— closes the gap where an SME previously only found out about a candidate's self-cancel by " +
      'noticing it in the manager console.',
  })
  @ApiParam({ name: 'id', description: 'Interview id', type: Number })
  // No InterviewManagerGuard here on purpose — the owning candidate can cancel their own
  // interview too; cancelInterview() itself enforces "owner OR privileged". Still requires
  // login via the global JwtAuthGuard.
  @Put(':id/cancel')
  async cancelInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Body() dto: CancelInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.cancelInterview(
      interviewId,
      dto,
      req.user,
    );
    return new ApiResponse('Interview cancelled successfully', result);
  }

  @ApiOperation({
    summary: 'Finalize the interview once satisfied with however many rounds ran (Interview Manager only)',
    description:
      'Requires every round to be resolved (nothing ASSIGNED/STARTED) and at least one round to have ' +
      'actually reached COMPLETED or DECLINED — otherwise 400. Does not auto-fire when the last round ' +
      'is submitted; this is always a deliberate manager action, so "was there another round?" is ' +
      "never an accident of timing. Optional `feedback` is the manager's own overall summary, " +
      "separate from each round's own SME feedback. Notifies the candidate (in-app + email).",
  })
  @ApiParam({ name: 'id', description: 'Interview id', type: Number })
  @UseGuards(InterviewManagerGuard)
  @Put(':id/finalize')
  async finalizeInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Body() dto: FinalizeInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.finalizeInterview(
      interviewId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Interview finalized successfully', result);
  }

  @ApiOperation({
    summary: 'SME starts a round assigned to them',
    description:
      'Only the round\'s own assigned interviewer may call this (403 for anyone else), and only ' +
      'while that round is ASSIGNED (400 otherwise — e.g. already started, or not assigned to you). ' +
      'Sets the round to STARTED and records `startedAt`.',
  })
  @ApiParam({ name: 'id', description: 'Interview id', type: Number })
  @ApiParam({ name: 'sessionId', description: 'AssessmentSession (round) id', type: Number })
  @Put(':id/rounds/:sessionId/start')
  async startInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.startInterview(
      interviewId,
      sessionId,
      req.user.id,
    );
    return new ApiResponse('Round started successfully', result);
  }

  @ApiOperation({
    summary: 'SME submits their assessment for a round they started',
    description:
      'Only the round\'s own assigned interviewer may call this, and only while the round is STARTED ' +
      '(you must "start" before you can "submit"). `status: COMPLETED` requires at least 3 distinct ' +
      'skill ratings. `status: DECLINED` is reserved for integrity issues (cheating, unauthorized ' +
      'assistance) found while actually conducting the round — never a way to opt out beforehand — ' +
      'and requires `declineReason`. Notifies the candidate (in-app + email) either way.',
  })
  @ApiParam({ name: 'id', description: 'Interview id', type: Number })
  @ApiParam({ name: 'sessionId', description: 'AssessmentSession (round) id', type: Number })
  @Put(':id/rounds/:sessionId/submit')
  async submitInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: SubmitInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.submitInterview(
      interviewId,
      sessionId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Round submitted successfully', result);
  }

  @ApiOperation({
    summary: 'List users who hold SME access (Interview Manager only)',
    description:
      "Source for the assign-round SME picker — returns every distinct user holding SME, " +
      "AssociateSME, or SMELead. Returns an empty array until someone's actually been granted one " +
      'of those permissions, not an error.',
  })
  // Registered before ':interviewCode' — otherwise Nest would match this path
  // as {interviewCode: 'sme-directory'}.
  @UseGuards(InterviewManagerGuard)
  @Get('sme-directory')
  async getSmeDirectory(): Promise<ApiResponse<any>> {
    const result = await this.interviewService.getSmeDirectory();
    return new ApiResponse('SME directory fetched successfully', result);
  }

  @ApiOperation({
    summary: 'Get the full interview report by its shareable code',
    description:
      'Returns the interview plus every round (each with its own SME, status, feedback, skill ' +
      'ratings) and the full audit-trail history, ordered by round number. Access restricted to: ' +
      "the candidate, any round's SME, an Admin, or an Interview Manager — 403 for anyone else, " +
      "404 if the code doesn't exist. Includes the computed `effectiveScheduledAt` field.",
  })
  @ApiParam({
    name: 'interviewCode',
    description: 'The interview\'s public-ish shareable code (not its numeric id)',
    type: String,
  })
  @Get(':interviewCode')
  async getInterviewDetails(
    @Param('interviewCode') interviewCode: string,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.getInterviewDetails(
      interviewCode,
      req.user,
    );

    return new ApiResponse('Interview details fetched successfully', result);
  }

  @ApiOperation({
    summary: 'List interviews — defaults to "my interviews as a candidate"',
    description:
      'There is no `userId` parameter — the caller\'s own id always comes from the verified JWT, ' +
      'never the request, so this can never be used to read someone else\'s list. Default (no ' +
      '`fetchAll`, no `interviewerId`): the caller\'s own interviews as candidate. Every returned ' +
      'interview includes its `assessmentSessions[]` and the computed `effectiveScheduledAt` field ' +
      '(what to display — resolves the active round\'s real time, falling back to the candidate\'s ' +
      'preference only if nothing\'s been scheduled yet).',
  })
  @ApiQuery({
    name: 'fetchAll',
    required: false,
    type: Boolean,
    description:
      'List every interview in the system instead of just the caller\'s own. Requires Admin or ' +
      'Role:InterviewManager — 403 for anyone else. Default false.',
  })
  @ApiQuery({
    name: 'interviewerId',
    required: false,
    type: Number,
    description:
      'View a specific SME\'s assigned-round queue instead of the caller\'s own candidate list. ' +
      'A privileged caller (Admin/InterviewManager) may look up any SME by id; anyone else is ' +
      'silently coerced to their own id regardless of what\'s passed here.',
  })
  @ApiQuery({
    name: 'when',
    required: false,
    enum: ['upcoming', 'past'],
    description:
      'Filters/sorts by the computed effectiveScheduledAt (not the raw stored date). Omit for no ' +
      'date filtering.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description:
      'When `interviewerId` resolves to a real filter, this matches round status ' +
      '(AssessmentSessionStatusEnum — e.g. ASSIGNED for an SME\'s pending queue). Otherwise it ' +
      "matches the interview's own overall status (InterviewStatusEnum).",
  })
  @ApiResponseDoc({
    status: 403,
    description: '`fetchAll=true` was requested by a caller who is not Admin or Interview Manager.',
  })
  // No userId query param — the candidate list always scopes to the authenticated
  // caller (req.user.id), verified server-side via the JWT, not a client-supplied id
  // that used to be trusted straight from the URL.
  @Get()
  async getInterviews(
    @Req() req: any,

    @Query('fetchAll', new DefaultValuePipe(false), ParseBoolPipe)
    fetchAll: boolean,

    @Query('interviewerId', new DefaultValuePipe(0), ParseIntPipe)
    interviewerId: number,

    @Query('when') when?: 'upcoming' | 'past',

    @Query('status') status?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.getInterviews(
      req.user,
      fetchAll,
      interviewerId || undefined,
      when,
      status,
    );

    return new ApiResponse('Interviews fetched successfully', result);
  }
}
