import { Controller, Get, Query, Req, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ActivityService } from './providers/activity/activity.service';
import { ApiResponse } from 'src/common/utils/api-response';

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
}
