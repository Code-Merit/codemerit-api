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
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse as ApiResponseDoc,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from 'src/common/policies/require-permission.decorator';
import { UserPermissionEnum, UserPermissionTitleEnum } from 'src/common/policies/user-permission.enum';
import { PermissionsGuard } from 'src/common/policies/permissions.guard';
import { ApiResponse } from 'src/common/utils/api-response';
import { CertificationTrackService } from './providers/certification-track.service';
import { CreateCertificationTrackDto } from './dtos/create-certification-track.dto';
import { LinkSubjectTracksDto } from './dtos/link-subject-tracks.dto';
import { LinkJobRoleDto } from './dtos/link-job-role.dto';
import { UpdateJobRoleLinkDto } from './dtos/update-job-role-link.dto';
import { UpdateCertificationTrackDto } from './dtos/update-certification-track.dto';

const intPipe = (label: string) =>
  new ParseIntPipe({
    errorHttpStatusCode: 400,
    exceptionFactory: () => new BadRequestException(`${label} must be a valid number`),
  });

@ApiTags('Certification Tracks')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@Controller('apis/certification-tracks')
export class CertificationTrackController {
  constructor(private readonly service: CertificationTrackService) {}

  @ApiOperation({
    summary: 'Create a certification track (permission required)',
    description:
      'Requires the `CertificationTrack:Create` permission as an unscoped (global) grant — there is ' +
      'no track id yet to scope it to, so a grant tied to a specific track id will not satisfy this ' +
      'check. 403 if the caller lacks it. The new track starts with no linked subject tracks or job ' +
      'roles; use the link endpoints below to attach them afterwards.',
  })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackCreate, UserPermissionTitleEnum.CertificationTrack)
  @Post('create')
  async create(@Body() dto: CreateCertificationTrackDto): Promise<ApiResponse<any>> {
    const result = await this.service.create(dto);
    return new ApiResponse(`${dto.title} created successfully.`, result);
  }

  @ApiOperation({
    summary: 'List every certification track (permission required)',
    description:
      'Requires an unscoped (global) `CertificationTrack:Get` grant — 403 otherwise. Returns all ' +
      'tracks ordered alphabetically by title, each including its linked job roles and subject ' +
      'tracks (with per-subject-track topic counts). Returns an empty array if none exist yet.',
  })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackGet, UserPermissionTitleEnum.CertificationTrack)
  @Get('all')
  async findAll(): Promise<ApiResponse<any>> {
    const result = await this.service.findAll();
    return new ApiResponse(`${result.length} certification tracks found.`, result);
  }

  @ApiOperation({
    summary: 'List certification tracks associated with a job role',
    description:
      'No specific permission is required beyond being logged in (JWT only). Looks up ' +
      'CertificationTrackJobRole links for the given job role, ordered by their configured ' +
      '`sortOrder`, and returns the full track detail for each. Returns an empty array if the job ' +
      'role has no certification tracks linked, including when `jobRoleId` does not exist.',
  })
  @ApiParam({ name: 'jobRoleId', description: 'Job Role id', type: Number })
  @Get('by-job-role/:jobRoleId')
  async findByJobRole(
    @Param('jobRoleId', intPipe('Job Role ID')) jobRoleId: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.findByJobRoleId(jobRoleId);
    return new ApiResponse(`${result.length} tracks found for job role.`, result);
  }

  @ApiOperation({
    summary: 'Get one certification track by id',
    description:
      'No specific permission is required beyond being logged in (JWT only). Returns the track ' +
      'with its linked job roles and subject tracks (each subject track annotated with its topic ' +
      'count). 404 if the id does not exist.',
  })
  @ApiParam({ name: 'id', description: 'Certification Track id', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No certification track exists with this id.' })
  @Get(':id')
  async findOne(
    @Param('id', intPipe('Certification Track ID')) id: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.findOne(id);
    return new ApiResponse('Certification track found.', result);
  }

  @ApiOperation({
    summary: 'Update a certification track (permission required)',
    description:
      'Requires the `CertificationTrack:Update` permission, matched either as a grant scoped to ' +
      'this exact track id or an unscoped (global) grant — 403 otherwise. 404 if the id does not ' +
      'exist. Only the fields present in the body are patched (title/description); linked job roles ' +
      'and subject tracks are managed separately via the link/unlink endpoints below.',
  })
  @ApiParam({ name: 'id', description: 'Certification Track id', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No certification track exists with this id.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackUpdate, UserPermissionTitleEnum.CertificationTrack)
  @Put('update/:id')
  async update(
    @Param('id', intPipe('Certification Track ID')) id: number,
    @Body() dto: UpdateCertificationTrackDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.update(id, dto);
    return new ApiResponse('Certification track updated.', result);
  }

  @ApiOperation({
    summary: 'Delete a certification track (permission required)',
    description:
      'Requires the `CertificationTrack:Delete` permission, matched either as a grant scoped to this ' +
      'exact track id or an unscoped (global) grant — 403 otherwise. 404 if the id does not exist. ' +
      'This only removes the CertificationTrack row itself; it does not cascade-delete its linked ' +
      'job-role or subject-track association rows, so run the unlink endpoints first if a clean ' +
      'removal is required.',
  })
  @ApiParam({ name: 'id', description: 'Certification Track id', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No certification track exists with this id.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackDelete, UserPermissionTitleEnum.CertificationTrack)
  @Delete('delete/:id')
  async remove(
    @Param('id', intPipe('Certification Track ID')) id: number,
  ): Promise<ApiResponse<any>> {
    await this.service.remove(id);
    return new ApiResponse('Certification track deleted.', null);
  }

  @ApiOperation({
    summary: 'Link a subject track to a certification track (permission required)',
    description:
      'Requires `CertificationTrack:Update`, matched either as a grant scoped to this exact track id ' +
      'or an unscoped (global) grant — 403 otherwise. 404 if the track id does not exist. Accepts one ' +
      'or more `subjectTrackIds`; any id already linked is silently skipped (no duplicate rows, no ' +
      'error), so this is safe to call repeatedly with an overlapping list.',
  })
  @ApiParam({ name: 'id', description: 'Certification Track id', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No certification track exists with this id.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackUpdate, UserPermissionTitleEnum.CertificationTrack)
  @Post(':id/subject-tracks')
  async linkSubjectTracks(
    @Param('id', intPipe('Certification Track ID')) id: number,
    @Body() dto: LinkSubjectTracksDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.linkSubjectTracks(id, dto);
    return new ApiResponse('Subject tracks linked to certification track.', result);
  }

  @ApiOperation({
    summary: 'Unlink a subject track from a certification track (permission required)',
    description:
      'Requires `CertificationTrack:Update`, matched either as a grant scoped to this exact track id ' +
      'or an unscoped (global) grant — 403 otherwise. 404 if the certification track id does not ' +
      'exist. Deleting a link that does not exist is a silent no-op — no error if the subject track ' +
      'was never linked or was already unlinked.',
  })
  @ApiParam({ name: 'id', description: 'Certification Track id', type: Number })
  @ApiParam({ name: 'subjectTrackId', description: 'Subject Track id to unlink', type: Number })
  @ApiResponseDoc({ status: 404, description: 'No certification track exists with this id.' })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackUpdate, UserPermissionTitleEnum.CertificationTrack)
  @Delete(':id/subject-tracks/:subjectTrackId')
  async unlinkSubjectTrack(
    @Param('id', intPipe('Certification Track ID')) id: number,
    @Param('subjectTrackId', intPipe('Subject Track ID')) subjectTrackId: number,
  ): Promise<ApiResponse<any>> {
    await this.service.unlinkSubjectTrack(id, subjectTrackId);
    return new ApiResponse('Subject track unlinked from certification track.', null);
  }

  @ApiOperation({
    summary: 'Link (or update) a job role on a certification track (permission required)',
    description:
      'Requires `CertificationTrack:Update`, matched either as a grant scoped to this exact track id ' +
      'or an unscoped (global) grant — 403 otherwise. 404 if `jobRoleId` in the body does not exist ' +
      'as a real JobRole. If this track is already linked to that job role, the existing link is ' +
      'updated in place (sortOrder/isPublished/descriptionOverride) rather than creating a duplicate ' +
      "— unspecified fields keep the existing link's current values. Otherwise a new link is created " +
      'with `sortOrder` defaulting to 1 and `isPublished` defaulting to true.',
  })
  @ApiParam({ name: 'id', description: 'Certification Track id', type: Number })
  @ApiResponseDoc({
    status: 404,
    description: 'The certification track id does not exist, or `jobRoleId` in the body does not exist.',
  })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackUpdate, UserPermissionTitleEnum.CertificationTrack)
  @Post(':id/job-roles')
  async linkJobRole(
    @Param('id', intPipe('Certification Track ID')) id: number,
    @Body() dto: LinkJobRoleDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.linkJobRole(id, dto);
    return new ApiResponse('Job role linked to certification track.', result);
  }

  @ApiOperation({
    summary: "Update an existing track-to-job-role link's display settings (permission required)",
    description:
      'Requires `CertificationTrack:Update`, matched either as a grant scoped to this exact track id ' +
      'or an unscoped (global) grant — 403 otherwise. 404 if this certification track is not ' +
      'currently linked to `jobRoleId` (use the link endpoint above to create the association ' +
      'first). Only the fields present in the body are patched (sortOrder/isPublished/' +
      'descriptionOverride).',
  })
  @ApiParam({ name: 'id', description: 'Certification Track id', type: Number })
  @ApiParam({ name: 'jobRoleId', description: 'Job Role id already linked to this track', type: Number })
  @ApiResponseDoc({
    status: 404,
    description: 'This certification track is not associated with the given jobRoleId.',
  })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackUpdate, UserPermissionTitleEnum.CertificationTrack)
  @Put(':id/job-roles/:jobRoleId')
  async updateJobRoleLink(
    @Param('id', intPipe('Certification Track ID')) id: number,
    @Param('jobRoleId', intPipe('Job Role ID')) jobRoleId: number,
    @Body() dto: UpdateJobRoleLinkDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.updateJobRoleLink(id, jobRoleId, dto);
    return new ApiResponse('Job role association updated.', result);
  }

  @ApiOperation({
    summary: 'Unlink a job role from a certification track (permission required)',
    description:
      'Requires `CertificationTrack:Update`, matched either as a grant scoped to this exact track id ' +
      'or an unscoped (global) grant — 403 otherwise. 404 if this certification track is not ' +
      'currently linked to `jobRoleId`.',
  })
  @ApiParam({ name: 'id', description: 'Certification Track id', type: Number })
  @ApiParam({ name: 'jobRoleId', description: 'Job Role id to unlink', type: Number })
  @ApiResponseDoc({
    status: 404,
    description: 'This certification track is not associated with the given jobRoleId.',
  })
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackUpdate, UserPermissionTitleEnum.CertificationTrack)
  @Delete(':id/job-roles/:jobRoleId')
  async unlinkJobRole(
    @Param('id', intPipe('Certification Track ID')) id: number,
    @Param('jobRoleId', intPipe('Job Role ID')) jobRoleId: number,
  ): Promise<ApiResponse<any>> {
    await this.service.unlinkJobRole(id, jobRoleId);
    return new ApiResponse('Job role unlinked from certification track.', null);
  }
}
