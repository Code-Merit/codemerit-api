import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { ApiResponse } from 'src/common/utils/api-response';
import { CreateInviteDto } from './dtos/create-invite.dto';
import { RedeemInviteDto } from './dtos/redeem-invite.dto';
import { InvitesService } from './providers/invites.service';

@ApiTags('Invites')
@ApiBearerAuth('access-token')
@Controller('apis/invites')
export class InvitesController {
  constructor(private readonly service: InvitesService) {}

  @ApiOperation({
    summary: 'Create (or reuse) an invite and send it',
    description:
      'Generic across every invite type — certification/badge/mock-interview/question-review/ ' +
      'plain join. Re-inviting the same recipient for the same type+target reuses the existing ' +
      'pending invite instead of creating a duplicate. Email invites are sent immediately; Phone ' +
      'invites are created but not auto-sent (no SMS provider wired up yet) — share the code manually.',
  })
  @Post()
  async create(@Body() dto: CreateInviteDto, @Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.service.create(dto, req.user.id);
    return new ApiResponse('Invite created successfully.', result);
  }

  @ApiOperation({
    summary: 'Redeem an invite code, or skip',
    description:
      'Called from the post-signup referral-code page. Omit `code` entirely for Skip — the ' +
      'prompt is still marked seen either way, so it never shows again for this user.',
  })
  @Post('redeem')
  async redeem(@Body() dto: RedeemInviteDto, @Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.service.redeem(dto, req.user.id);
    return new ApiResponse(
      result.skipped ? 'Invite step skipped.' : 'Invite redeemed successfully.',
      result,
    );
  }

  @ApiOperation({
    summary: "The caller's own invite counts plus a small top-inviters leaderboard",
  })
  @Get('stats')
  async stats(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.service.getStats(req.user.id);
    return new ApiResponse('Invite stats fetched successfully.', result);
  }

  @ApiOperation({
    summary: 'Public landing-page info for an invite code (no auth)',
    description:
      'Backs the /invite/:code public page — just enough to render "X invited you to Y" ' +
      'before the visitor signs up. Declared after /stats on purpose so that literal route ' +
      'is never shadowed by this wildcard :code param.',
  })
  @ApiParam({ name: 'code', description: 'Invite code from the shared link.' })
  @Public()
  @Get(':code')
  async publicInfo(@Param('code') code: string): Promise<ApiResponse<any>> {
    const result = await this.service.getPublicInfo(code);
    return new ApiResponse('Invite info fetched successfully.', result);
  }
}
