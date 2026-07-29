import { Controller, Get, Query, Req, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityService } from './providers/activity/activity.service';
import { ApiResponse } from 'src/common/utils/api-response';

@ApiTags('Activity')
@ApiBearerAuth('access-token')
@Controller('apis/activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  // The caller's own recent activity feed — in-app notifications for events
  // like "Interview Rescheduled", "Interview Assigned", "Interview Completed".
  // No dedicated read/unread state exists yet (Activity has no isRead column);
  // this is a feed, not an inbox.
  @Get('mine')
  async findMine(
    @Req() req: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.activityService.findByUserId(req.user.id, limit);
    return new ApiResponse('Activity fetched successfully', result);
  }
}
