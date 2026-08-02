import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse } from 'src/common/utils/api-response';
import { CreateQuestionDto } from './dtos/create-question.dto';
import { GetQuestionsByIdsDto } from './dtos/get-questions-by-ids.dto';
import { UpdateQuestionDto } from './dtos/update-question.dto';
import { WhitelistQuestionDto } from './dtos/whitelist-question.dto';
import { QuestionService } from './providers/question.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from 'src/common/policies/permissions.guard';
import { RequirePermission } from 'src/common/policies/require-permission.decorator';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import {
  UserPermissionEnum,
  UserPermissionTitleEnum,
} from 'src/common/policies/user-permission.enum';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { RolesGuard } from 'src/core/auth/guards/roles.guard';
import { Roles } from 'src/core/auth/decorators/roles.decorator';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { UserPermissionService } from '../user-permission/providers/user-permission.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';

@ApiTags('Questions')
@Controller('apis/question')
export class QuestionController {
  constructor(
    private readonly service: QuestionService,
    private readonly userPermissionService: UserPermissionService,
  ) {}

  @ApiOperation({
    summary: 'Create a new question (QuestionAuthorCreate permission required)',
    description:
      'Requires the QuestionAuthorCreate permission on the Question permission title — the ' +
      'PermissionsGuard rejects anyone without it before this handler runs. Auto-generates a unique ' +
      'slug from the question text, retrying on collision. `topicIds` is mandatory — 400 "Topics are ' +
      'mendatory" if empty. For any `questionType` other than General, at least 2 `options` are ' +
      'required and at least one must be marked `correct` (400 otherwise); General questions ignore ' +
      'options entirely. The whole insert (question + topics + options) runs in one transaction, so a ' +
      'topic/option validation failure rolls back the question row too. Each option\'s text is capped ' +
      'at 100 characters at the database column level with no request-time length check, so an ' +
      'oversized option currently fails at save time with a raw DB error rather than a clean 400 — ' +
      'this is the same 100-char limit that makes the seed data silently skip oversized questions.',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(
    UserPermissionEnum.QuestionAuthorCreate,
    UserPermissionTitleEnum.Question,
  )
  @Post('create')
  async create(@Body() data: CreateQuestionDto): Promise<ApiResponse<any>> {
    console.log('called controller');

    const result = await this.service.createQuestion(data);
    return new ApiResponse('Question created successfully', result);
  }

  @ApiOperation({
    summary: 'Admin/author search over questions (Admin or LMS Manager only)',
    description:
      'Callers who are not Admin must hold the LmsManager permission (permissionId 4) or get a 403. ' +
      'Holding LmsManager does not widen visibility, though: any caller whose role is not Admin is ' +
      'always scoped to questions they authored themselves (`createdBy` = caller id), regardless of ' +
      'the `authorId` filter — only an Admin can actually browse other authors\' questions via ' +
      '`authorId`. `fetchAll=true` ignores `limit` entirely and returns every matching row; otherwise ' +
      'results are capped at `limit` (default 100), newest first. Throws 404 "No Question found for ' +
      'the given filters" when nothing matches rather than returning an empty array.',
  })
  @ApiQuery({ name: 'fullData', required: false, type: String, description: 'Pass "true" or "1" to include each question\'s options in the response; otherwise options are omitted.' })
  @ApiQuery({ name: 'subjectId', required: false, type: String, description: 'Filter to a single subject id.' })
  @ApiQuery({ name: 'topicId', required: false, type: String, description: 'Filter to a single topic id (inner-joins questionTopics).' })
  @ApiQuery({ name: 'level', required: false, type: String, description: 'One of "Easy", "Intermediate", "Advanced" (mapped to DifficultyLevelEnum); omitted or unrecognized values apply no level filter.' })
  @ApiQuery({ name: 'authorId', required: false, type: String, description: 'Filter to a specific author id. Only effective for Admin callers — non-Admin callers are already scoped to their own authored questions.' })
  @ApiQuery({ name: 'fetchAll', required: false, type: String, description: 'Pass "true" or "1" to return every matching question, ignoring `limit`. Default false (limited list).' })
  @ApiQuery({ name: 'limit', required: false, type: String, description: 'Max rows to return when `fetchAll` is not set. Default 100.' })
  @ApiResponseDoc({ status: 403, description: 'Caller is not Admin and does not hold the LmsManager permission.' })
  @ApiResponseDoc({ status: 404, description: 'No question matches the given filters.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findQuestionList(
    @Query('fullData') fullData?: string,
    @Query('subjectId') subjectId?: string,
    @Query('topicId') topicId?: string,
    @Query('level') level?: string,
    @Query('authorId') authorId?: string,
    @Query('fetchAll') fetchAll?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ): Promise<ApiResponse<any>> {
    if (req?.user?.role !== UserRoleEnum.ADMIN) {
      const permissions =
        await this.userPermissionService.findUserPermissionList(req?.user?.id);

      const isLmsManager = permissions.some(
        (p: any) =>
          Number(p.permissionId) === 4 ||
          p.permissionName === UserPermissionEnum.LmsManager,
      );

      if (!isLmsManager) {
        throw new AppCustomException(
          HttpStatus.FORBIDDEN,
          'You are not authorized to make this request.',
        );
      }
    }

    const isFullData = fullData === 'true' || fullData === '1';
    const subjectIdNum = subjectId ? parseInt(subjectId, 10) : undefined;
    const topicIdNum = topicId ? parseInt(topicId, 10) : undefined;
    const levelMap: Record<string, number> = {
      Easy: DifficultyLevelEnum.Easy,
      Intermediate: DifficultyLevelEnum.Intermediate,
      Advanced: DifficultyLevelEnum.Advanced,
    };
    const normalizedLevel = level?.trim();
    const levelNum =
      normalizedLevel && normalizedLevel !== ''
        ? levelMap[normalizedLevel]
        : undefined;
    const authorIdNum = authorId ? parseInt(authorId, 10) : undefined;
    const fetchAllFlag = fetchAll === 'true' || fetchAll === '1';
    const limitNum = limit ? parseInt(limit, 10) : 100; // default 100

    const result = await this.service.getQuestionListForAdmin(
      isFullData,
      subjectIdNum,
      topicIdNum,
      levelNum,
      authorIdNum,
      fetchAllFlag,
      limitNum,
      req.user,
    );
    //?subjectId=5&fetchAll=true - Fetch all questions for a subject
    //?fullData=true&limit=5 - Fetch first 5 questions with full options and topics
    //?fullData=true&topicId=11
    if (!result || result.length === 0) {
      return new ApiResponse('You have not created a question yet.', null);
    }
    return new ApiResponse(`${result.length} Question(s) fetched.`, result);
  }

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
    summary: 'List Active questions for the quiz builder picker (LMS Manager only)',
    description:
      'Requires the LmsManager permission (permissionId 4) — 403 for anyone else, with no Admin ' +
      'bypass (unlike the plain question list above, this check has no role shortcut). Only returns ' +
      'questions with status Active. `subjectIds`/`topicIds` are comma-separated id lists; when both ' +
      'are supplied both filters apply together (AND, not OR). Returns an empty array rather than an ' +
      'error when nothing matches.',
  })
  @ApiQuery({ name: 'subjectIds', required: false, type: String, description: 'Comma-separated subject ids, e.g. "1,2,3".' })
  @ApiQuery({ name: 'topicIds', required: false, type: String, description: 'Comma-separated topic ids, e.g. "10,20".' })
  @ApiQuery({ name: 'level', required: false, type: String, description: 'Either the numeric DifficultyLevelEnum value or its name ("Easy"/"Intermediate"/"Advanced").' })
  @ApiResponseDoc({ status: 403, description: 'Caller does not hold the LmsManager permission.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Get('quizBuilder')
  async findQuizBuilderQuestions(
    @Query('subjectIds') subjectIds?: string,
    @Query('topicIds') topicIds?: string,
    @Query('level') level?: string,
    @Request() req?: any,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req?.user?.id);

    const parseIds = (value?: string): number[] => {
      if (!value) {
        return [];
      }
      return Array.from(
        new Set(
          String(value)
            .split(',')
            .map((item) => parseInt(item.trim(), 10))
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      );
    };

    const subjectIdsFinal = parseIds(subjectIds);
    const topicIdsFinal = parseIds(topicIds);

    const levelMap: Record<string, number> = {
      Easy: DifficultyLevelEnum.Easy,
      Intermediate: DifficultyLevelEnum.Intermediate,
      Advanced: DifficultyLevelEnum.Advanced,
    };
    const normalizedLevel = level?.trim();
    const numericLevel = normalizedLevel ? Number(normalizedLevel) : NaN;
    const levelNum =
      normalizedLevel && normalizedLevel !== ''
        ? Number.isNaN(numericLevel)
          ? levelMap[normalizedLevel]
          : numericLevel
        : undefined;

    const result = await this.service.getQuizBuilderQuestions(
      subjectIdsFinal.length > 0 ? subjectIdsFinal : undefined,
      topicIdsFinal.length > 0 ? topicIdsFinal : undefined,
      levelNum,
    );

    return new ApiResponse('Questions fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Update a question (QuestionAuthorUpdate permission required)',
    description:
      'Requires the QuestionAuthorUpdate permission — the PermissionsGuard rejects anyone without it. ' +
      '`questionType` and `subjectId` are mandatory on every update (400 if missing). Whitelisted ' +
      'questions can only be modified by an Admin (403 for everyone else). A Moderator may only ' +
      'update a question they authored themselves (404 "no permission" otherwise). `topicIds`, if ' +
      'provided, is diffed against the existing set — topics no longer listed are removed, new ones ' +
      'inserted. For any `questionType` other than General, at least 2 `options` are required with at ' +
      'least one marked `correct` (400 otherwise, same as create); switching a question to General ' +
      'deletes all of its existing options. Runs as one transaction, rolled back on any of the above ' +
      'validation failures. Same 100-character DB column cap on option text as question creation.',
  })
  @ApiQuery({ name: 'id', required: true, type: Number, description: 'Id of the question to update.' })
  @ApiResponseDoc({ status: 403, description: 'Question is whitelisted and the caller is not an Admin.' })
  @ApiResponseDoc({ status: 404, description: 'Caller is a Moderator who does not own this question.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(
    UserPermissionEnum.QuestionAuthorUpdate,
    UserPermissionTitleEnum.Question,
  )
  @Put('update')
  async update(
    @Query('id') id: number,
    @Body() dto: UpdateQuestionDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.updateQuestion(id, dto, req.user);
    return new ApiResponse('Question updated successfully.', result);
  }

  @ApiOperation({
    summary: 'List distinct question authors',
    description:
      'Returns every distinct user who has authored at least one question, as `{id, name}` pairs — ' +
      'used to populate the author filter on the admin question list above. No permission check ' +
      'beyond being logged in.',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Get('authors')
  async findQuestionAuthors(): Promise<ApiResponse<any>> {
    const result = await this.service.getQuestionAuthors();
    return new ApiResponse('Question authors fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Get one question by slug (public)',
    description:
      'No auth or permission check — publicly readable. Returns the question with its options, ' +
      'topics, subject title, and author summary. Note: a nonexistent slug is not translated into a ' +
      'clean 404 — the service does not null-check before reading properties off the result, so an ' +
      'unknown slug currently surfaces as an unhandled server error rather than a friendly response.',
  })
  @ApiParam({ name: 'slug', description: 'The question\'s slug.', type: String })
  @Get(':slug')
  async findOne(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const result = await this.service.findOneBySlug(slug);
    return new ApiResponse('Question Found.', result);
  }

  @ApiOperation({
    summary: 'Whitelist or un-whitelist a question (Admin only)',
    description:
      'Only an Admin may call this (RolesGuard + Roles(ADMIN) — 403 for anyone else). Whitelisting a ' +
      'question locks it: whitelisted questions can then only be edited or deleted by an Admin, even ' +
      'the original author loses write access. 404 if the question id does not exist.',
  })
  @ApiResponseDoc({ status: 404, description: 'Question with the given id was not found.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Put('approval')
  async whitelistQuestion(
    @Body() dto: WhitelistQuestionDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.whitelistQuestion(
      dto.questionId,
      dto.isWhitelisted,
      req.user,
    );
    return new ApiResponse(
      `Question ${dto.isWhitelisted ? 'whitelisted' : 'removed from whitelist'} successfully.`,
      result,
    );
  }

  @ApiOperation({
    summary: 'Delete a question (QuestionAuthorDelete permission required)',
    description:
      'Requires the QuestionAuthorDelete permission — the PermissionsGuard rejects anyone without it. ' +
      'Whitelisted questions can only be deleted by an Admin (403 for everyone else). Otherwise an ' +
      'Admin can delete any question, and a Moderator can only delete a question they authored ' +
      'themselves (404 "User dont have permission to delete" for anyone else, including a Moderator ' +
      'trying to delete someone else\'s question). Cascades within one transaction: deletes the ' +
      'question\'s options and topic links before deleting the question row itself. 404 if the id ' +
      'does not exist at all.',
  })
  @ApiQuery({ name: 'id', required: true, type: Number, description: 'Id of the question to delete.' })
  @ApiResponseDoc({ status: 403, description: 'Question is whitelisted and the caller is not an Admin.' })
  @ApiResponseDoc({ status: 404, description: 'Question not found, or caller lacks permission to delete it.' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(
    UserPermissionEnum.QuestionAuthorDelete,
    UserPermissionTitleEnum.Question,
  )
  @Delete('delete')
  async remove(
    @Query('id') id: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.remove(id, req.user);

    return new ApiResponse('Question deleted successfully.', null);
  }

  @ApiOperation({
    summary: 'Fetch a random batch of Trivia questions for end-user quizzes (public)',
    description:
      'No auth required. Requires at least one of `subjectIds` or `topicIds` (400 otherwise). Only ' +
      'considers questions with `questionType: Trivia` and `status: Active`. When `topicIds` is given ' +
      'it takes priority over `subjectIds` for grouping — the requested `numQuestions` is spread as ' +
      'evenly as possible across whichever group list is used, picked randomly per group. If the ' +
      'random pass comes up short, a fallback query backfills the shortfall from the same pool ' +
      '(excluding already-picked ids); if there still aren\'t enough matching questions after the ' +
      'fallback, throws 400 reporting how many were found vs. needed.',
  })
  @ApiResponseDoc({ status: 400, description: 'Neither subjectIds nor topicIds provided, or not enough matching Trivia questions exist.' })
  @Post('fetch')
  async getQuestionsByIds(
    @Body() dto: GetQuestionsByIdsDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.getQuestionsByIds(dto);
    if (!result || result.length === 0) {
      return new ApiResponse('No questions found', null);
    }
    return new ApiResponse('Questions fetched successfully.', result);
  }
}
