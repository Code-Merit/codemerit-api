import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseIntPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { TopicsService } from './providers/topics.service';
import { CreateTopicDto } from './dtos/create-topics.dto';
import { UpdateTopicDto } from './dtos/update-topics.dto';
import { ApiResponse } from 'src/common/utils/api-response';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { RequirePermission } from 'src/common/policies/require-permission.decorator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from 'src/common/policies/permissions.guard';
import { UserPermissionEnum, UserPermissionTitleEnum } from 'src/common/policies/user-permission.enum';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse as ApiResponseDoc,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Topics')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@Controller('apis/topics')
export class TopicsController {
  constructor(private readonly topicService: TopicsService) { }

  @ApiOperation({
    summary: 'Create a topic (permission required)',
    description:
      'Requires the `Topic:Create` permission — 403 otherwise. Auto-generates a URL-safe `slug` from ' +
      '`title`; if that slug is already taken by another topic, a unique suffixed variant is generated ' +
      'instead of erroring, so duplicate titles never collide. Set `parent` to nest this under another ' +
      'topic id, or omit it for a top-level topic.',
  })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.TopicCreate, UserPermissionTitleEnum.Topic)
  @Post('create')
  async create(
    @Body() createTopicDto: CreateTopicDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.topicService.create(createTopicDto);
    return new ApiResponse(`${createTopicDto.title} added successfully.`, result);
  }

  @ApiOperation({
    summary: 'List every topic (permission required)',
    description:
      'Requires the `Topic:Get` permission — 403 otherwise. Returns every topic in the system ' +
      '(published or not), newest id first, each including its parent subject name. Unlike the ' +
      'public by-subject listing below, this is not filtered to published topics or top-level-only.',
  })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.TopicGet, UserPermissionTitleEnum.Topic)
  @Get('/all')
  async findAll(): Promise<ApiResponse<any>> {
    const result = await this.topicService.findAll();
    return new ApiResponse('Topics Found', result);
  }

  @ApiOperation({
    summary: 'Get one topic by id',
    description:
      'No specific permission is required beyond being logged in (JWT only). Returns the raw Topic ' +
      'entity as stored. Note: unlike most other lookups in this API, an unknown `topicId` does not ' +
      'throw a 404 here — it resolves quietly to a null `data` field in the response. Because this ' +
      'route and the by-subject route below share the same single dynamic-segment path shape and ' +
      'this one is registered first, any single-segment `GET /apis/topics/:x` request is handled here, ' +
      'not by the by-subject route.',
  })
  @ApiParam({ name: 'topicId', description: 'Topic id', type: Number })
  @Get(':topicId')
  async findOne(
    @Param(
      'topicId',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Topic Id must be a valid number'),
      }),
    )
    topicId: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.topicService.findOne(topicId);
    return new ApiResponse('Topic Found', result);
  }

  @ApiOperation({
    summary: 'Update a topic (permission required)',
    description:
      'Requires the `Topic:Update` permission — 403 otherwise. Only the fields present in the body ' +
      'are patched (title/subjectId/label/order/parent/isPublished/description/goal); the `slug` is ' +
      'not regenerated even if `title` changes.',
  })
  @ApiParam({ name: 'id', description: 'Topic id', type: Number })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.TopicUpdate, UserPermissionTitleEnum.Topic)
  @Put('update/:id')
  async update(
    @Param(
      'id',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Topic Id must be a valid number'),
      }),
    )
    topicId: number,
    @Body() updateTopicDto: UpdateTopicDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.topicService.update(topicId, updateTopicDto);
    return new ApiResponse(
      `${updateTopicDto.title} updated successfully.`,
      result,
    );
  }

  @ApiOperation({
    summary: 'Delete a topic (permission required)',
    description:
      'Requires the `Topic:Delete` permission — 403 otherwise. Deletes the Topic row directly with no ' +
      'existence check beforehand and no cascade handling for questions or sub-topics referencing it; ' +
      'deleting an id that does not exist is a silent no-op.',
  })
  @ApiParam({ name: 'id', description: 'Topic id', type: Number })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.TopicDelete, UserPermissionTitleEnum.Topic)
  @Delete('delete/:id')
  async remove(
    @Param(
      'id',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Topic Id must be a valid number'),
      }),
    )
    topicId: number,
  ): Promise<ApiResponse<any>> {
    await this.topicService.remove(topicId);
    return new ApiResponse('Topic deleted.', null);
  }

  @ApiOperation({
    summary: 'List top-level topics for a subject, with their sub-topics (public)',
    description:
      'No login required. Returns only published, top-level topics (`parent` is null) for the given ' +
      'subject, each with its nested `subTopics` (id/title/description only, not further nested). ' +
      'Caution: this shares the exact same single dynamic-segment path shape as `GET /:topicId` above, ' +
      "which is registered earlier in this controller — under Nest's declaration-order route matching " +
      'that earlier route wins, so in practice this handler is currently unreachable via ' +
      '`GET /apis/topics/:subjectId`. Also note the handler reads `result[0].subjectName` before ' +
      'returning, so a subject with zero matching topics throws rather than returning an empty list.',
  })
  @ApiParam({ name: 'subjectId', description: 'Subject id', type: Number })
  @ApiResponseDoc({
    status: 500,
    description:
      'Thrown if the subject has no published top-level topics — the response message indexes into ' +
      'an empty result array.',
  })
  @Public()
  @Get(':subjectId')
  async findAllTopicListBySubjectId(
    @Param(
      'subjectId',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Subject Id must be a valid number'),
      }),
    )
    subjectId: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.topicService.findAllBySubjectId(subjectId);
    return new ApiResponse(
      `${result.length} topics found in Subject ${result[0].subjectName}`,
      result,
    );
  }
}
