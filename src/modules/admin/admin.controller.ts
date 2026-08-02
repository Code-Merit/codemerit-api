import {
    Controller,
    Get,
    UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiResponse } from 'src/common/utils/api-response';
import { Roles } from 'src/core/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/core/auth/guards/roles.guard';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { AdminService } from './providers/admin.service';


@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('apis/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  @ApiOperation({
    summary: 'Get the full admin dashboard summary (Admin only)',
    description:
      'Aggregates people, content, engagement, achievements, interview, recent-activity, and ' +
      'trend statistics into one payload for the admin dashboard. Restricted to UserRoleEnum.ADMIN ' +
      "— 403 for anyone else. Each section is fetched independently and, if its query fails, is " +
      "swapped for a zeroed fallback rather than failing the whole response; `meta.partial` and " +
      "`meta.failedSections` tell the frontend which sections (if any) fell back so it can " +
      'distinguish "genuinely empty" from "failed to load".',
  })
  @UseGuards(RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Get('dashboard')
  async getAdminDash(): Promise<ApiResponse<any>> {
    const result = await this.adminService.getDashboardSummary();
    if (result) {
      return new ApiResponse('Data fetched successfully.', result);
    }
    return new ApiResponse('Error fetching data.', null);
  }
}
