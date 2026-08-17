import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { UserPermissionEnum } from 'src/common/policies/user-permission.enum';
import { ApiResponse } from 'src/common/utils/api-response';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/core/auth/jwt/optional-jwt-auth-guard';
import { UserPermissionService } from '../user-permission/providers/user-permission.service';
import { CreateLessonDto } from './dtos/create-lesson.dto';
import { GetLessonsDto } from './dtos/get-lessons.dto';
import { UpdateLessonDto } from './dtos/update-lesson.dto';
import { UpdateLessonProgressDto } from './dtos/update-lesson-progress.dto';
import { LessonService } from './providers/lesson.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';

@ApiTags('Lessons')
@Controller('apis/lesson')
export class LessonController {
  constructor(
    private readonly service: LessonService,
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
    summary: 'Create a lesson (LMS Manager only)',
    description:
      'Requires the LmsManager permission (permissionId 4) via the manual `ensureLmsAccess` check — ' +
      '403 for anyone else, with no Admin bypass. `subjectId`/`subject` and `topicId`/`topic` (either ' +
      'field name is accepted) are both mandatory, as is at least one entry in `sections` — 400 ' +
      'if any are missing. `format` defaults to "tutorial" if omitted (`comic` lessons are always ' +
      'free — see LessonService.evaluateLessonAccess). Auto-generates a unique slug from the title, ' +
      'retrying on collision. Saves the lesson and its section rows together in one transaction.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @ApiResponseDoc({ status: 400, description: 'Missing subjectId, topicId, or sections.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Post('create')
  async create(
    @Body() data: CreateLessonDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.service.createLesson(data, req.user.id);
    return new ApiResponse('Lesson created successfully', result);
  }

  @ApiOperation({
    summary: 'Update a lesson in place (LMS Manager only)',
    description:
      'Requires the LmsManager permission, same as create. All fields optional — only what\'s ' +
      'provided is changed. When `sections` is provided, it replaces the full section set ' +
      '(delete-and-reinsert), so always send the complete list of sections, not a partial diff. ' +
      'The lesson\'s own id/slug and every `UserLessonTracker` progress row for it are left ' +
      'untouched — editing content never resets a learner\'s progress. 404 if the slug does not exist.',
  })
  @ApiParam({ name: 'slug', description: 'The lesson\'s slug.', type: String })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @ApiResponseDoc({ status: 404, description: 'No lesson exists with the given slug.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Patch(':slug')
  async update(
    @Param('slug') slug: string,
    @Body() data: UpdateLessonDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);
    const result = await this.service.updateLesson(slug, data);
    return new ApiResponse('Lesson updated successfully', result);
  }

  @ApiOperation({
    summary: 'List lessons — personalized feed when logged in, discovery feed otherwise (public)',
    description:
      'Login is optional (OptionalJwtAuthGuard). With no `userId` (anonymous), or a logged-in user ' +
      'with no enrolled subjects (direct enrollment or via a job role\'s curriculum), the response is ' +
      'always a random discovery sample. Once the caller has enrolled subjects: `fetch=all` returns ' +
      'every lesson across those subjects in stable subject/topic/level order (for something like a ' +
      'progress dashboard, not a shuffled sample); without `fetch=all` it\'s a random sample scoped to ' +
      'those subjects (for recommendation-style feeds). Each lesson includes `myProgress` (null when ' +
      'logged out or never accessed).',
  })
  @ApiQuery({ name: 'n', required: false, type: Number, description: 'Max lessons to return. Default 10.' })
  @ApiQuery({ name: 'fetch', required: false, enum: ['all'], description: 'Pass "all" to fetch every lesson across the caller\'s enrolled subjects (deterministic order) instead of a random sample. Ignored for anonymous/unenrolled callers, who always get a random sample regardless.' })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Query() query: GetLessonsDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.findLessons(query, req.user?.id);
    return new ApiResponse('Lessons fetched successfully', result);
  }

  @ApiOperation({
    summary: 'Get one lesson by slug (public)',
    description:
      'Login is optional (OptionalJwtAuthGuard) — when logged in, the response includes `myProgress` ' +
      'from the caller\'s existing tracker row, or null if they have never accessed this lesson. ' +
      'Purely read-only: viewing a lesson through this endpoint never creates or mutates a progress ' +
      'tracker row, so a page refresh or a crawler hitting public lesson pages cannot fabricate ' +
      'access history — that only happens via the explicit access-recording endpoint below. 404 if ' +
      'the slug does not exist.',
  })
  @ApiParam({ name: 'slug', description: 'The lesson\'s slug.', type: String })
  @ApiResponseDoc({ status: 404, description: 'No lesson exists with the given slug.' })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.findBySlug(slug, req.user?.id);
    return new ApiResponse('Lesson fetched successfully', result);
  }

  @ApiOperation({
    summary: "Record that the caller opened a lesson",
    description:
      'Creates the caller\'s progress tracker on first view (status Pending, `views: 1`) or ' +
      'increments `views` on every subsequent call. Never touches `status`/`progressPercent` — those ' +
      'only change via the progress-update endpoint below, so "opened it" and "made progress on it" ' +
      'stay two independent signals rather than one call meaning both. If two requests race to create ' +
      'the tracker for the same user+lesson for the first time (e.g. two tabs), the losing insert\'s ' +
      'unique-constraint error is caught and resolved by re-reading the row the winner just created, ' +
      'so this never surfaces a spurious error to a user who did nothing wrong. 404 if the slug does ' +
      'not exist.',
  })
  @ApiParam({ name: 'slug', description: 'The lesson\'s slug.', type: String })
  @ApiResponseDoc({ status: 404, description: 'No lesson exists with the given slug.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Post(':slug/access')
  async recordAccess(
    @Param('slug') slug: string,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.recordLessonAccess(req.user.id, slug);
    return new ApiResponse('Lesson access recorded successfully', result);
  }

  @ApiOperation({
    summary: "Update the caller's own progress on a lesson",
    description:
      'Requires at least one of `status`, `progressPercent`, `useful`, or `quality` in the body — ' +
      '400 if all are omitted. Creates the tracker on the fly if the caller jumps straight to e.g. ' +
      '"mark complete" without a prior access-record call. Reconciliation rules: setting ' +
      '`status: Completed` always forces `progressPercent` to 100; setting `status: Pending` with no ' +
      '`progressPercent` in the same call resets it to 0; any other explicit status leaves the ' +
      'percent untouched. Sending only `progressPercent` (no `status`) derives status from its value ' +
      '(100 -> Completed, 0 -> Pending, else -> Read) UNLESS the tracker\'s current status is the ' +
      'manually-set NeedsRevisit or Reported, which a stray progress ping never silently overwrites. ' +
      '`useful`/`quality` (1-5) record the learner\'s rating and are deliberately independent of ' +
      '`status`/`progressPercent` — ratable on a lesson that\'s still in progress or was never ' +
      'finished, not just on completion. Each resubmission overwrites the previous rating rather ' +
      'than accumulating one. 404 if the slug does not exist.',
  })
  @ApiParam({ name: 'slug', description: 'The lesson\'s slug.', type: String })
  @ApiResponseDoc({ status: 400, description: 'None of status, progressPercent, useful, or quality was provided.' })
  @ApiResponseDoc({ status: 404, description: 'No lesson exists with the given slug.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Patch(':slug/progress')
  async updateProgress(
    @Param('slug') slug: string,
    @Body() dto: UpdateLessonProgressDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.updateLessonProgress(
      req.user.id,
      slug,
      dto,
    );
    return new ApiResponse('Lesson progress updated successfully', result);
  }
}
