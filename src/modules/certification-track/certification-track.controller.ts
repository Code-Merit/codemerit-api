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
import { ApiTags } from '@nestjs/swagger';
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
@Controller('apis/certification-tracks')
export class CertificationTrackController {
  constructor(private readonly service: CertificationTrackService) {}

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackCreate, UserPermissionTitleEnum.CertificationTrack)
  @Post('create')
  async create(@Body() dto: CreateCertificationTrackDto): Promise<ApiResponse<any>> {
    const result = await this.service.create(dto);
    return new ApiResponse(`${dto.title} created successfully.`, result);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackGet, UserPermissionTitleEnum.CertificationTrack)
  @Get('all')
  async findAll(): Promise<ApiResponse<any>> {
    const result = await this.service.findAll();
    return new ApiResponse(`${result.length} certification tracks found.`, result);
  }

  @Get('by-job-role/:jobRoleId')
  async findByJobRole(
    @Param('jobRoleId', intPipe('Job Role ID')) jobRoleId: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.findByJobRoleId(jobRoleId);
    return new ApiResponse(`${result.length} tracks found for job role.`, result);
  }

  @Get(':id')
  async findOne(
    @Param('id', intPipe('Certification Track ID')) id: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.findOne(id);
    return new ApiResponse('Certification track found.', result);
  }

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

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.CertificationTrackDelete, UserPermissionTitleEnum.CertificationTrack)
  @Delete('delete/:id')
  async remove(
    @Param('id', intPipe('Certification Track ID')) id: number,
  ): Promise<ApiResponse<any>> {
    await this.service.remove(id);
    return new ApiResponse('Certification track deleted.', null);
  }

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
