import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ApiResponse } from 'src/common/utils/api-response';
import { CreateNotificationDto } from './dtos/create-notification.dto';
import { NotificationService } from './providers/notification.service';

@ApiTags('Notifications')
@Controller('apis/notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({
    summary: 'Create a raw in-app notification',
    description:
      'Directly inserts a Notification row for `userId` with the given title/message — this is ' +
      'the low-level create path (no email is sent here, unlike the typed notifyXxx() helpers ' +
      'used internally for badges/certificates/streaks/etc., which write a notification AND send ' +
      'an email). `notifyEmail`/`notifySMS` are stored as flags on the row but do not themselves ' +
      'trigger delivery from this endpoint.',
  })
  @Post()
  async create(@Body() dto: CreateNotificationDto): Promise<ApiResponse<any>> {
    const data = await this.notificationService.create(dto);
    return new ApiResponse('Notification created successfully.', data);
  }

  @ApiOperation({
    summary: "List a user's most recent notifications",
    description:
      'Returns up to 50 notifications for `userId`, newest first (by id). If `userId` is omitted ' +
      'or 0, returns up to 50 notifications across all users instead of a specific inbox.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'User id to fetch notifications for. Omit or pass 0 to list across all users. Default 0.',
  })
  @Get()
  async findLatest(
    @Query('userId', new DefaultValuePipe(0), ParseIntPipe) userId: number,
  ): Promise<ApiResponse<any>> {
    const data = await this.notificationService.findByUserId(userId, 50);
    return new ApiResponse('Notifications fetched successfully.', data);
  }
}
