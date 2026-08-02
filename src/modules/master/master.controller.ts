import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/core/auth/jwt/optional-jwt-auth-guard';
import { AddUserSubjectsDto } from 'src/core/users/dtos/user-subject.dto';
import { ApiResponse } from 'src/common/utils/api-response';
import { UserPermissionService } from '../user-permission/providers/user-permission.service';
import { MasterService } from './providers/master.service';
import { TopicAnalysisService } from './providers/topic-analysis.service';
import { SubjectStatsService } from './providers/subject-stats.service';
import { ProgramService } from './providers/program.service';
import { MeritService } from './providers/merit.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';

@ApiTags('Master Data')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@Controller('apis/master')
export class MasterController {
  constructor(
    private readonly masterService: MasterService,
    private readonly subjectStats: SubjectStatsService,
    private readonly programService: ProgramService,
    private readonly topicAnalysisProvider: TopicAnalysisService,
    private readonly userPermissionService: UserPermissionService,
    private readonly meritService: MeritService,
  ) {}

  @ApiOperation({
    summary: 'Get master bootstrap data (public — personalized when logged in)',
    description:
      'Aggregates the subject catalog, job roles (each with their subjects), globally popular ' +
      'topics, subject tracks, and certification tracks into one payload used to seed app-wide ' +
      'dropdowns/nav on load. Runs six independent lookups in parallel. When called with a valid ' +
      "JWT, the subject list's `isSubscribed` flags reflect the caller's own UserSubject rows; " +
      'anonymous callers get the same catalog with every subject unsubscribed.',
  })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('data')
  async getMasterData(@Request() req: any) {
    const userId = req.user?.id;
    return this.masterService.getMasterData(userId);
  }

  @ApiOperation({
    summary: 'Subscribe the caller to one or more subjects',
    description:
      "Creates a UserSubject row for each `subjectId` not already subscribed, scoped to the " +
      "caller's own id from the JWT. Subject ids the caller is already subscribed to are not " +
      "treated as an error — they're skipped and reported individually in `results[]` with a " +
      '"already added" status alongside the newly-added ones. `subjectIds` must be a non-empty ' +
      'array of unique integers (enforced by the DTO); any unexpected database failure is caught ' +
      'and surfaced as a 500.',
  })
  @Post('userSubjects')
  async addUserSubjects(@Request() req, @Body() dto: AddUserSubjectsDto) {
    const userId = req.user.id;
    return this.masterService.addUserSubjects(userId, dto);
  }

  @ApiOperation({
    summary: "Get one subject's full dashboard page by slug (public — personalized when logged in)",
    description:
      'Returns the subject plus its syllabus/topic breakdown, subject tracks, certification tracks, ' +
      'lessons, related job roles, and badges. When authenticated, also includes the ' +
      '`attempted`/`correct`/`wrong`/`coverage`/`currentAccuracy`/`score` metrics plus the separate ' +
      '"journey" totals (every attempt ever, retries included) and the caller\'s own subject ratings ' +
      '— anonymous callers get those fields zeroed and an empty ratings list. Returns 404 if `slug` ' +
      "does not match a published subject.",
  })
  @ApiQuery({ name: 'slug', required: true, type: String, description: 'The subject slug to look up.' })
  @ApiResponseDoc({ status: 404, description: 'No subject exists with the given slug.' })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('subjectDashboard')
  async getSubjectDashboard(@Query('slug') slug: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.subjectStats.getSubjectPage(slug, userId);
  }

  @ApiOperation({
    summary: 'Get per-topic stats, either for one subject or across every topic',
    description:
      'When `subjectId` is supplied and parses to a positive integer, returns stats scoped to that ' +
      "subject's topics only; otherwise returns stats for all topics (internally capped at 300, no " +
      'pagination params exposed here). Requires login. Non-Admin callers only see topics whose ' +
      "parent subject they're subscribed to (via UserSubject) — Admins see every topic regardless " +
      'of subscription.',
  })
  @ApiQuery({
    name: 'subjectId',
    required: false,
    type: String,
    description: 'Numeric subject id to scope results to. Omit to fetch stats for all topics.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('subjectTopicsDashboard')
  async subjectTopicsDashboard(
    @Query('subjectId') subjectId?: string,
    @Request() req?: any,
  ) {
    const subjectIdNum = subjectId ? parseInt(subjectId, 10) : undefined;
    if (subjectIdNum && subjectIdNum > 0) {
      return this.topicAnalysisProvider.getTopicStatsBySubject(subjectIdNum, req.user);
    }
    return this.topicAnalysisProvider.getAllTopicStats(req.user);
  }

  @ApiOperation({
    summary: "Get the caller's legacy career dashboard (one card per subscribed job role)",
    description:
      'Returns per-job-role subject scores and certification-track progress plus a top-level ' +
      '`overallSummary`. Superseded by GET career-dashboard below (which adds lessons/badges/' +
      '"next best action"), but kept for backward-compatible clients. Returns an all-zero summary ' +
      "with an empty `jobRoles[]` if the caller isn't subscribed to any job role.",
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('myCareerDashboard')
  async getCareerDashboard(@Request() req: any) {
    return this.programService.getCareerDashboard(req.user.id);
  }

  @ApiOperation({
    summary: "Get the caller's enriched career dashboard (scores, lessons, badges, next-best-action)",
    description:
      "Builds on the legacy career dashboard's data with lesson-completion metrics, per-job-role " +
      'badges, and a computed `nextCertificationTrack`/`nextSubjectTrack` suggestion (the ' +
      'closest-to-completion not-yet-achieved cert, and the closest-to-completion subject track ' +
      'within it). Any unexpected error is caught and logged server-side rather than propagated — ' +
      'the caller gets an all-zero, empty-arrays dashboard shape instead of a 500.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('career-dashboard')
  async getEnrichedCareerDashboard(@Request() req: any) {
    return this.programService.getEnrichedCareerDashboard(req.user.id);
  }

  @ApiOperation({
    summary: "Get the caller's subjects, each nested with its own per-topic stats",
    description:
      "Combines the caller's subject list with all-topic stats, then nests every topic under its " +
      'parent `subjectId`. Distinct from the flat career-dashboard responses above — this shape is ' +
      'for views that need a subject-with-its-topics tree rather than job-role rollups. Requires login.',
  })
  @Get('userQuizStats')
  async getUserStats(@Request() req) {
    const userId = req.user?.id;
    return this.masterService.getUserQuizStats(userId);
  }

  @ApiOperation({
    summary: "Get the caller's role/permission-filtered navigation menu (public — personalized when logged in)",
    description:
      'Assembles the nav tree by unioning route groups gated on the caller\'s permissions (Sme, ' +
      'LmsManager, InterviewManager role-or-permission, TalentPartner, Admin role), then recursively ' +
      "drops any branch — and any parent left with no visible children — the caller can't see. " +
      "Anonymous callers only get routes tagged for the 'All' role.",
  })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('routes')
  async getRoutes(@Request() req: any) {
    const permissions = await this.userPermissionService.findUserPermissionList(req.user?.id);
    const result = await this.masterService.getRoutesConfig(req.user?.role, permissions);
    return new ApiResponse('Routes fetched successfully.', result);
  }

  @ApiOperation({
    summary: "Get a job role/program's full detail page by slug (public — personalized when logged in)",
    description:
      'Returns the job role plus its subjects (each with subject tracks and topics), certification ' +
      'tracks, and a merit leaderboard for the whole role. Authenticated callers additionally get ' +
      'progress/score fields on every subject and cert track, plus a computed ' +
      '`nextCertificationTrack`/`nextSubjectTrack` suggestion. Returns 404 if `programSlug` does not ' +
      'match a published job role.',
  })
  @ApiParam({ name: 'programSlug', description: "The job role's slug", type: String })
  @ApiResponseDoc({ status: 404, description: 'No published job role exists with the given slug.' })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('programDetails/:programSlug')
  async getProgramDetails(@Param('programSlug') programSlug: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.programService.getProgramDetails(programSlug, userId);
  }

  @ApiOperation({
    summary: 'Get the global XP leaderboard (public — personalized when logged in)',
    description:
      "Ranks all users by lifetime `User.points` for `all-time`, or by XP summed from a user's " +
      'XP log since the start of the current week/month for the `weekly`/`monthly` windows — the ' +
      "windowed views exist so rank is achievable for newer users too, not just whoever's " +
      "accumulated the most points ever. Any value other than 'weekly'/'monthly' silently falls " +
      'back to `all-time`. Defaults to the top 10; pass `limit` for more (capped at 100). When ' +
      "authenticated, also includes the caller's own dense rank even when it falls outside `limit`.",
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['all-time', 'weekly', 'monthly'],
    description: 'Ranking window. Defaults to all-time.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of ranked entries to return. Defaults to 10, capped at 100.',
  })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('leaderboard')
  async getGlobalLeaderboard(
    @Query('period') period: 'all-time' | 'weekly' | 'monthly' = 'all-time',
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    const userId = req?.user?.id;
    const resolvedPeriod = ['weekly', 'monthly'].includes(period) ? period : 'all-time';
    const parsedLimit = Number(limit);
    const resolvedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 10;
    return this.meritService.getGlobalXpLeaderboard(userId, resolvedLimit, resolvedPeriod);
  }
}
