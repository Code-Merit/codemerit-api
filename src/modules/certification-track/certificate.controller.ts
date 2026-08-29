import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse as ApiResponseDoc, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/core/auth/jwt/optional-jwt-auth-guard';
import { ApiResponse } from 'src/common/utils/api-response';
import { CertificateService } from './providers/certificate.service';
import { GrantCertificateDto } from './dtos/grant-certificate.dto';
import { RevokeCertificateDto } from './dtos/revoke-certificate.dto';

@ApiTags('Certificates')
@ApiBearerAuth('access-token')
@Controller('apis/certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  /** Powers the public Browse Certificates page (`/certificates` on the frontend) — the full
   * published certification-track catalog grouped (Platform / per-subject), plus this caller's
   * `earned` and `inProgress` slices. Visitor-accessible on purpose, same as
   * apis/achievements/explorer: `earned`/`inProgress` come back empty for an anonymous caller,
   * `groups` is always the full catalog either way. */
  @ApiOperation({
    summary: 'Certificate explorer — full catalog grouped, plus earned/inProgress for the caller',
    description:
      'Returns `groups` (every published CertificationTrack, grouped into one "Platform" ' +
      'bucket for job-role-bundle tracks plus one bucket per subject for subject-native ' +
      'tracks), `earned` (this caller\'s achieved tracks, kept regardless of current ' +
      'enrollment), and `inProgress` (not-yet-achieved tracks tied to subjects/job roles the ' +
      'caller is really enrolled in). No authentication required — `earned`/`inProgress` are ' +
      'simply empty for an anonymous caller, `groups` is always the full catalog.',
  })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('explorer')
  async explorer(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.certificateService.getExplorer(req.user?.id);
    return new ApiResponse('Certificate explorer.', result);
  }

  @ApiOperation({
    summary: 'Verify a certificate by its printed verification code (public, no auth)',
    description:
      '404 if no certificate was ever issued with this code. Otherwise 200 — `valid:false` ' +
      'if the certificate exists but has since been revoked, `valid:true` with the ' +
      'certificate details otherwise.',
  })
  @ApiParam({ name: 'code', description: 'The verificationCode printed on the certificate' })
  @ApiResponseDoc({ status: 404, description: 'No certificate exists with this verification code.' })
  @Public()
  @Get('verify/:code')
  async verify(@Param('code') code: string): Promise<ApiResponse<any>> {
    const result = await this.certificateService.verify(code);
    return new ApiResponse(result.valid ? 'Certificate verified.' : 'Certificate is no longer valid.', result);
  }

  @ApiOperation({
    summary: 'Manually grant a certificate to a user',
    description:
      'Admins may grant any certificate; everyone else needs a CertificationTrack:Grant ' +
      'permission scoped to this exact track (or an unscoped/global grant) — 403 otherwise. ' +
      '404 if the track or user does not exist. Re-granting an already-issued certificate ' +
      'refreshes who granted it and the note rather than duplicating; re-granting a revoked ' +
      'one clears the revoke fields and re-issues it.',
  })
  @ApiResponseDoc({ status: 403, description: 'Granter lacks Admin role and lacks a matching CertificationTrack:Grant permission.' })
  @ApiResponseDoc({ status: 404, description: 'certificationTrackId or userId does not exist.' })
  @UseGuards(AuthGuard('jwt'))
  @Post('grant')
  async grant(@Body() dto: GrantCertificateDto, @Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.certificateService.grant({ id: req.user.id, role: req.user.role }, dto);
    return new ApiResponse('Certificate granted.', result);
  }

  @ApiOperation({
    summary: 'Revoke a previously issued certificate',
    description:
      'Same permission gate as grant. 404 if the certificate id does not exist. Sets status ' +
      'to REVOKED and records who revoked it and why.',
  })
  @ApiParam({ name: 'id', description: 'Certificate id', type: Number })
  @ApiResponseDoc({ status: 403, description: 'Granter lacks Admin role and lacks a matching CertificationTrack:Grant permission.' })
  @ApiResponseDoc({ status: 404, description: 'No certificate exists with this id.' })
  @UseGuards(AuthGuard('jwt'))
  @Put(':id/revoke')
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevokeCertificateDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.certificateService.revoke({ id: req.user.id, role: req.user.role }, id, dto);
    return new ApiResponse('Certificate revoked.', null);
  }
}
