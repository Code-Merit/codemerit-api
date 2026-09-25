import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiResponse } from 'src/common/utils/api-response';
import { UserPreferenceService } from './providers/user-preference.service';
import { UpdateUserPreferenceDto } from './dtos/update-user-preference.dto';

@Controller('apis/preferences')
export class UserPreferenceController {
  constructor(private readonly service: UserPreferenceService) {}

  @Get('me')
  @ApiOperation({
    summary: "Get the caller's own preferences",
    description: 'Every field defaults to its documented value when the user has never changed anything — this never creates a row.',
  })
  async getMine(@Req() req: any): Promise<ApiResponse<any>> {
    const result = await this.service.getPreferences(req.user.id);
    return new ApiResponse('Preferences fetched successfully.', result);
  }

  @Put('me')
  @ApiOperation({
    summary: "Update the caller's own preferences",
    description: 'Partial patch — only the fields present in the body are changed. Creates the row on first use.',
  })
  async updateMine(
    @Req() req: any,
    @Body() dto: UpdateUserPreferenceDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.service.updatePreferences(req.user.id, dto);
    return new ApiResponse('Preferences updated successfully.', result);
  }
}
