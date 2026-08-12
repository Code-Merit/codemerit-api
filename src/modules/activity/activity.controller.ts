import { Controller, Get, Query, Req, DefaultValuePipe, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ActivityService } from './providers/activity/activity.service';
import { ApiResponse } from 'src/common/utils/api-response';
import { Roles } from 'src/core/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/core/auth/guards/roles.guard';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';

@ApiTags('Activity')
@ApiBearerAuth('access-token')
@Controller('apis/activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @ApiOperation({
    summary: "Get the caller's own recent activity feed",
    description:
      'In-app notifications for events like "Interview Rescheduled", "Interview Assigned", ' +
      '"Interview Completed" — scoped to the authenticated caller only, newest first. There is no ' +
      'dedicated read/unread state yet (Activity has no isRead column); this is a feed, not an inbox.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of activity rows to return. Default 20.',
  })
  @Get('mine')
  async findMine(
    @Req() req: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.activityService.findByUserId(req.user.id, limit);
    return new ApiResponse('Activity fetched successfully', result);
  }

  @ApiOperation({
    summary: "Get any user's activity feed, or the latest across all users (Admin only)",
    description:
      'Restricted to UserRoleEnum.ADMIN — 403 for anyone else. If `username` is given, returns ' +
      'that user\'s activity feed (400 if no such user exists). If `username` is omitted, returns ' +
      'the latest activity across every user, newest first. Defaults to the top 200 rows either ' +
      'way. Each row includes a `user` object (id/username/firstName/lastName) so the caller can ' +
      'tell whose activity it is — `mine` deliberately omits this since it\'s always the caller.',
  })
  @ApiQuery({
    name: 'username',
    required: false,
    type: String,
    description: 'Target username. Omit to get the latest activity across all users.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of activity rows to return. Default 200.',
  })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Get()
  async findAll(
    @Query('username') username: string | undefined,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.activityService.findForAdmin(username, limit);
    return new ApiResponse('Activity fetched successfully', result);
  }
}
