import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse as ApiResponseDoc } from '@nestjs/swagger';
import { ApiResponse } from 'src/common/utils/api-response';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { UserPermissionEnum } from 'src/common/policies/user-permission.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QualityResourceTypeEnum } from 'src/common/enum/quality-resource-type.enum';
import { Roles } from 'src/core/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/core/auth/guards/roles.guard';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { LmsService } from './providers/lms.service';
import { QuestionQualityService } from './providers/question-quality.service';
import { LmsDashboardService } from './providers/lms-dashboard.service';
import { SubmitQualityReviewDto } from './dtos/submit-quality-review.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserPermissionService } from '../user-permission/providers/user-permission.service';

@ApiTags('LMS')
@ApiBearerAuth('access-token')
@Controller('apis/lms')
export class LmsController {
  constructor(
    private readonly lmsService: LmsService,
    private readonly questionQualityService: QuestionQualityService,
    private readonly lmsDashboardService: LmsDashboardService,
    private readonly userPermissionService: UserPermissionService,
  ) {}

  private async ensureLmsAccess(userId: number) {
    const permissions =
      await this.userPermissionService.findUserPermissionList(userId);

    const isLmsManager = permissions.some(
      (permission: any) =>
        Number(permission.permissionId) === 4 ||
        permission.permissionName === UserPermissionEnum.LmsManager,
    );

    if (!isLmsManager) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You are not authorized to make this request.',
      );
    }
  }

  @ApiOperation({
    summary: "Get the caller's LMS content-authoring dashboard",
    description:
      'Aggregates stats on the questions/quizzes/lessons the authenticated caller has authored ' +
      '(via `req.user.id`), plus a daily/weekly time series of their question and quiz creation ' +
      'activity. Question stats are scoped to the caller; quiz, lesson, and time-series stats ' +
      'return zeroed placeholders if the caller id is missing.',
  })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('dashboard')
  async getAdminDash(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.lmsService.getDashboardSummary(req.user?.id);
    if (result) {
      return new ApiResponse('Data fetched successfully.', result);
    }
    return new ApiResponse('Error fetching data.', null);
  }

  @ApiOperation({
    summary: 'Get a user\'s created Standard quizzes with attempt stats (LMS Manager only)',
    description:
      'Returns every Standard-type quiz `userId` created, each with its total attempt count and ' +
      'average score. Restricted to callers holding the LmsManager permission (checked against ' +
      'the caller from the JWT, not `userId`) — 403 for anyone else, regardless of role.',
  })
  @ApiParam({ name: 'userId', description: 'Id of the quiz author to look up', type: Number })
  @ApiResponseDoc({
    status: 403,
    description: 'Caller does not hold the LmsManager permission.',
  })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('user-standard-quiz/:userId')
  async getUserStandardQuizzes(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);

    const result = await this.lmsService.getUserStandardQuizzes(userId);
    return new ApiResponse(
      'User standard quizzes fetched successfully.',
      result,
    );
  }

  @ApiOperation({
    summary: 'List questions for SME quality review, any author (LMS Manager only)',
    description:
      'Deliberately cross-author — unlike GET apis/question, which scopes non-Admin callers ' +
      'to their own createdBy. Quality review only makes sense across every author. ' +
      '`status=unreviewed` (reviewCount=0), `status=flagged` (latest outcome NeedsRevision/' +
      'Rejected), or `status=all` (default). Ordered least-reviewed first.',
  })
  @ApiQuery({ name: 'subjectSlug', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['unreviewed', 'flagged', 'all'] })
  @ApiQuery({ name: 'questionType', required: false, enum: QuestionTypeEnum })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Default 100.' })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @ApiResponseDoc({ status: 404, description: 'No subject found for the given slug.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('questions')
  async getReviewQueue(
    @Request() req: any,
    @Query('subjectSlug') subjectSlug?: string,
    @Query('status') status?: 'unreviewed' | 'flagged' | 'all',
    @Query('questionType') questionType?: QuestionTypeEnum,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.questionQualityService.getReviewQueue({
      subjectSlug,
      status,
      questionType,
      limit: limit ? Number(limit) : undefined,
    });
    return new ApiResponse('Review queue fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Get one question for SME quality review, any author (LMS Manager only)',
    description:
      'Full question detail (options, hint, answer, topics) for the review dialog — ' +
      'deliberately not author-scoped, same reasoning as the queue above.',
  })
  @ApiParam({ name: 'id', description: 'Question id', type: Number })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('questions/:id/review-detail')
  async getQuestionReviewDetail(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.questionQualityService.getQuestionReviewDetail(id);
    if (!result) {
      return new ApiResponse('Question not found.', null);
    }
    return new ApiResponse('Question review detail fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'List the SME content-quality issue-tag catalog (LMS Manager only)',
    description:
      'Named, reusable quality issues an SME can attach to a question review (e.g. "Wrong ' +
      'question or answer"). Admin/seed-managed — no create/edit endpoint yet. Optionally ' +
      'filtered to tags that apply to a given question type (Trivia/General); tags with a ' +
      'null questionTypeScope apply to both.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('quality-metrics')
  async getQualityMetrics(
    @Request() req: any,
    @Query('questionType') questionType?: QuestionTypeEnum,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.questionQualityService.listQualityMetrics(questionType);
    return new ApiResponse('Quality metrics fetched successfully.', result);
  }

  @ApiOperation({
    summary: "Get a question's SME quality-review history (LMS Manager only)",
    description:
      'Every review pass ever submitted for this question, newest first, with the reviewer ' +
      'and attached issue tags — the full iterative audit trail (a question can be reviewed ' +
      'more than once over its life).',
  })
  @ApiParam({ name: 'id', description: 'Question id', type: Number })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('questions/:id/quality-reviews')
  async getQuestionQualityReviews(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.questionQualityService.getReviewHistory(QualityResourceTypeEnum.Question, id);
    return new ApiResponse('Quality review history fetched successfully.', result);
  }

  @ApiOperation({
    summary: "Submit the caller's SME quality review for a question (LMS Manager only)",
    description:
      'Always creates a new, final review pass — there is no draft/in-progress state, so ' +
      'every call here is a permanent addition to the audit trail. Computes an advisory ' +
      'grade-cap from the worst attached issue tag\'s severity (never enforced, returned once ' +
      'in the response, not stored), and rolls the result up onto the question ' +
      '(reviewCount/lastReviewedAt/latestGrade/lastReviewOutcome), including nudging its ' +
      'moderation status (Approve: Pending -> Active; Reject: Active -> Pending).',
  })
  @ApiParam({ name: 'id', description: 'Question id', type: Number })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Post('questions/:id/quality-reviews')
  async submitQuestionQualityReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubmitQualityReviewDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.questionQualityService.submitReview(
      QualityResourceTypeEnum.Question,
      id,
      req.user?.id,
      body,
    );
    return new ApiResponse('Quality review submitted successfully.', result);
  }

  @ApiOperation({
    summary: 'Get the Quality Pipeline dashboard summary (LMS Manager only)',
    description:
      'Combines existing moderation counts (Question.status/isWhitelisted), attempt-derived ' +
      'signals from QuestionAttempt (never-attempted dead stock, too-hard/too-easy/confusing ' +
      'outliers, minimum sample size 10), and the new SME review schema (review coverage, ' +
      'grade distribution, flagged-for-revision queue, top issue tags). Optionally scoped to ' +
      'one subject.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('dashboard/quality-pipeline')
  async getQualityPipeline(
    @Request() req: any,
    @Query('subjectId') subjectId?: string,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.questionQualityService.getQualityPipelineSummary(
      subjectId ? Number(subjectId) : undefined,
    );
    return new ApiResponse('Quality pipeline summary fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Get the LMS Command Center Subjects dashboard (LMS Manager only)',
    description:
      'One row per subject — published or not, this is an SME/QA workspace, not a publish ' +
      'gate — combining question volume/moderation/review-coverage, lesson aggregates, quiz ' +
      'aggregates (Standard vs. UserQuiz, with two 7-day attempt windows for growth), and a ' +
      'composite health score. No server-side sort/filter/pagination: the payload backs both ' +
      'the Subjects tab table and the Overview tab, which derives its KPIs/needs-attention/' +
      'top-movers client-side from this same array.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('dashboard/subjects')
  async getSubjectsDashboard(@Request() req: any): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.lmsDashboardService.getSubjectsDashboard();
    return new ApiResponse('Subjects dashboard fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Get LMS activity trends (LMS Manager only)',
    description:
      'Daily/weekly bucketed series for Questions submitted, Standard quiz attempts, ' +
      'UserQuiz attempts (from QuizResult, one row per quiz-taking session — not ' +
      'QuestionAttempt, which would inflate counts per-question), and SME reviews submitted. ' +
      'Also returns a per-week attempt-outcome breakdown (correct/wrong/skipped) and a ' +
      'snapshot lesson funnel (viewed/read/completed). `range` defaults to 7d; `subjectId` ' +
      'scopes every series via its natural join path.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('dashboard/trends')
  async getTrends(
    @Request() req: any,
    @Query('range') range?: '7d' | '30d' | '90d',
    @Query('subjectId') subjectId?: string,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.lmsDashboardService.getTrends(
      range ?? '7d',
      subjectId ? Number(subjectId) : undefined,
    );
    return new ApiResponse('Trends fetched successfully.', result);
  }
}
