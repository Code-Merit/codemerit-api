import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';
import { RequirePermission } from 'src/common/policies/require-permission.decorator';
import { UserPermissionEnum, UserPermissionTitleEnum } from 'src/common/policies/user-permission.enum';
import { PermissionsGuard } from 'src/common/policies/permissions.guard';
import { ApiResponse } from 'src/common/utils/api-response';
import { CreateSubjectTrackDto } from './dtos/create-subject-track.dto';
import { LinkTopicsDto } from './dtos/link-topics.dto';
import { UpdateSubjectTrackDto } from './dtos/update-subject-track.dto';
import { SubjectTrackService } from './providers/subject-track.service';

const intPipe = (label: string) =>
  new ParseIntPipe({
    errorHttpStatusCode: 400,
    exceptionFactory: () => new BadRequestException(`${label} must be a valid number`),
  });

@ApiTags('Subject Tracks')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@Controller('apis/subject-tracks')
export class SubjectTrackController {
  constructor(private readonly service: SubjectTrackService) {}

  @ApiOperation({
    summary: 'Create a subject track (requires SubjectTrackCreate permission)',
    description:
      'A subject track is a titled grouping of topics within one subject (e.g. a certification ' +
      "module). The track's slug is auto-generated from `title`, with a random suffix appended if " +
      'the derived slug already exists on another track — this endpoint never rejects on a slug ' +
      "collision. 403 if the caller lacks the SubjectTrack-scoped SubjectTrackCreate permission.",
  })
  @ApiResponseDoc({ status: 403, description: 'Caller lacks the SubjectTrackCreate permission.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.SubjectTrackCreate, UserPermissionTitleEnum.SubjectTrack)
  @Post('create')
  async create(@Body() dto: CreateSubjectTrackDto): Promise<ApiResponse<any>> {
    const result = await this.service.create(dto);
    return new ApiResponse(`${dto.title} created successfully.`, result);
  }

  @ApiOperation({
    summary: 'List every subject track (requires SubjectTrackGet permission)',
    description:
      'Returns all subject tracks across all subjects, ordered by subjectId then sortOrder, each ' +
      'including its resolved subject name, topic count, and linked topics. 403 if the caller lacks ' +
      'the SubjectTrack-scoped SubjectTrackGet permission.',
  })
  @ApiResponseDoc({ status: 403, description: 'Caller lacks the SubjectTrackGet permission.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.SubjectTrackGet, UserPermissionTitleEnum.SubjectTrack)
  @Get('all')
  async findAll(): Promise<ApiResponse<any>> {
    const result = await this.service.findAll();
    return new ApiResponse(`${result.length} subject tracks found.`, result);
  }

  @ApiOperation({
    summary: "List a single subject's tracks",
    description:
      'Returns every subject track belonging to `subjectId`, ordered by sortOrder, each including ' +
      'its linked topics. No permission check beyond the global JWT guard — returns an empty array ' +
      '(not a 404) if the subject has no tracks or does not exist.',
  })
  @ApiParam({ name: 'subjectId', description: 'Subject id to list tracks for', type: Number })
  @Get('by-subject/:subjectId')
  async findBySubject(
    @Param('subjectId', intPipe('Subject ID')) subjectId: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.findBySubjectId(subjectId);
    return new ApiResponse(`${result.length} tracks found for subject.`, result);
  }

  @ApiOperation({
    summary: 'Get one subject track by id',
    description:
      'Returns the track plus its resolved subject name and full list of linked topics. 404 if no ' +
      'track exists with the given id.',
  })
  @ApiParam({ name: 'id', description: 'Subject track id', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No subject track exists with the given id.' })
  @Get(':id')
  async findOne(
    @Param('id', intPipe('Subject Track ID')) id: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.findOne(id);
    return new ApiResponse('Subject track found.', result);
  }

  @ApiOperation({
    summary: 'Update a subject track (requires SubjectTrackUpdate permission)',
    description:
      'Partially updates title/description/slug/sortOrder/isPublished — only fields present in the ' +
      'body are changed; `slug` is NOT re-derived from a new `title` here (pass it explicitly if it ' +
      'needs to change). 404 if the track does not exist; 403 if the caller lacks the ' +
      'SubjectTrack-scoped SubjectTrackUpdate permission.',
  })
  @ApiParam({ name: 'id', description: 'Subject track id', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No subject track exists with the given id.' })
  @ApiResponseDoc({ status: 403, description: 'Caller lacks the SubjectTrackUpdate permission.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.SubjectTrackUpdate, UserPermissionTitleEnum.SubjectTrack)
  @Put('update/:id')
  async update(
    @Param('id', intPipe('Subject Track ID')) id: number,
    @Body() dto: UpdateSubjectTrackDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.update(id, dto);
    return new ApiResponse('Subject track updated.', result);
  }

  @ApiOperation({
    summary: 'Delete a subject track (requires SubjectTrackDelete permission)',
    description:
      'Hard-deletes the track itself. Its subject_track_topic link rows are left to the database\'s ' +
      'own cascade/constraint behavior — this endpoint does not explicitly unlink topics first. 404 ' +
      'if the track does not exist; 403 if the caller lacks the SubjectTrack-scoped ' +
      'SubjectTrackDelete permission.',
  })
  @ApiParam({ name: 'id', description: 'Subject track id', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No subject track exists with the given id.' })
  @ApiResponseDoc({ status: 403, description: 'Caller lacks the SubjectTrackDelete permission.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.SubjectTrackDelete, UserPermissionTitleEnum.SubjectTrack)
  @Delete('delete/:id')
  async remove(
    @Param('id', intPipe('Subject Track ID')) id: number,
  ): Promise<ApiResponse<any>> {
    await this.service.remove(id);
    return new ApiResponse('Subject track deleted.', null);
  }

  @ApiOperation({
    summary: 'Link topics to a subject track (requires SubjectTrackUpdate permission)',
    description:
      "Links each topic id in `topicIds` to the track, skipping any that are already linked (no " +
      'duplicate rows, no error on re-linking). Rejects with 404 if any topic id does not exist, or ' +
      '400 if any topic belongs to a different subject than the track itself — a subject track can ' +
      'only ever contain topics from its own subject. 403 if the caller lacks the SubjectTrack-scoped ' +
      'SubjectTrackUpdate permission.',
  })
  @ApiParam({ name: 'id', description: 'Subject track id', type: Number })
  @ApiResponseDoc({ status: 404, description: 'The track, or one of the given topic ids, does not exist.' })
  @ApiResponseDoc({ status: 400, description: 'One of the given topic ids belongs to a different subject than this track.' })
  @ApiResponseDoc({ status: 403, description: 'Caller lacks the SubjectTrackUpdate permission.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.SubjectTrackUpdate, UserPermissionTitleEnum.SubjectTrack)
  @Post(':id/topics')
  async linkTopics(
    @Param('id', intPipe('Subject Track ID')) id: number,
    @Body() dto: LinkTopicsDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.linkTopics(id, dto);
    return new ApiResponse(`Topics linked to subject track.`, result);
  }

  @ApiOperation({
    summary: 'Unlink one topic from a subject track (requires SubjectTrackUpdate permission)',
    description:
      'Removes the subject_track_topic link row, if one exists — a no-op (not an error) if the ' +
      'topic was never linked to this track. 404 if the track itself does not exist; 403 if the ' +
      'caller lacks the SubjectTrack-scoped SubjectTrackUpdate permission.',
  })
  @ApiParam({ name: 'id', description: 'Subject track id', type: Number })
  @ApiParam({ name: 'topicId', description: 'Topic id to unlink', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No subject track exists with the given id.' })
  @ApiResponseDoc({ status: 403, description: 'Caller lacks the SubjectTrackUpdate permission.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.SubjectTrackUpdate, UserPermissionTitleEnum.SubjectTrack)
  @Delete(':id/topics/:topicId')
  async unlinkTopic(
    @Param('id', intPipe('Subject Track ID')) id: number,
    @Param('topicId', intPipe('Topic ID')) topicId: number,
  ): Promise<ApiResponse<any>> {
    await this.service.unlinkTopic(id, topicId);
    return new ApiResponse('Topic unlinked from subject track.', null);
  }
}
