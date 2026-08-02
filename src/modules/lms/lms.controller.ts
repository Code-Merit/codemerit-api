import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse as ApiResponseDoc } from '@nestjs/swagger';
import { ApiResponse } from 'src/common/utils/api-response';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { UserPermissionEnum } from 'src/common/policies/user-permission.enum';
import { Roles } from 'src/core/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/core/auth/guards/roles.guard';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { LmsService } from './providers/lms.service';
import { AuthGuard } from '@nestjs/passport';
import { UserPermissionService } from '../user-permission/providers/user-permission.service';

@ApiTags('LMS')
@ApiBearerAuth('access-token')
@Controller('apis/lms')
export class LmsController {
  constructor(
    private readonly lmsService: LmsService,
    private readonly userPermissionService: UserPermissionService,
  ) {}

  private async ensureLmsAccess(userId: number) {
    const permissions =
      await this.userPermissionService.findUserPermissionList(userId);

    const isLmsManager = permissions.some(
      (permission: any) =>
        Number(permission.permissionId) === 4 ||
        permission.permissionName === UserPermissionEnum.LmsManager,
    );

    if (!isLmsManager) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You are not authorized to make this request.',
      );
    }
  }

  @ApiOperation({
    summary: "Get the caller's LMS content-authoring dashboard",
    description:
      'Aggregates stats on the questions/quizzes/lessons the authenticated caller has authored ' +
      '(via `req.user.id`), plus a daily/weekly time series of their question and quiz creation ' +
      'activity. Question stats are scoped to the caller; quiz, lesson, and time-series stats ' +
      'return zeroed placeholders if the caller id is missing.',
  })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('dashboard')
  async getAdminDash(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.lmsService.getDashboardSummary(req.user?.id);
    if (result) {
      return new ApiResponse('Data fetched successfully.', result);
    }
    return new ApiResponse('Error fetching data.', null);
  }

  @ApiOperation({
    summary: 'Get a user\'s created Standard quizzes with attempt stats (LMS Manager only)',
    description:
      'Returns every Standard-type quiz `userId` created, each with its total attempt count and ' +
      'average score. Restricted to callers holding the LmsManager permission (checked against ' +
      'the caller from the JWT, not `userId`) — 403 for anyone else, regardless of role.',
  })
  @ApiParam({ name: 'userId', description: 'Id of the quiz author to look up', type: Number })
  @ApiResponseDoc({
    status: 403,
    description: 'Caller does not hold the LmsManager permission.',
  })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRoleEnum.USER)
  @Get('user-standard-quiz/:userId')
  async getUserStandardQuizzes(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.ensureLmsAccess(req.user?.id);

    const result = await this.lmsService.getUserStandardQuizzes(userId);
    return new ApiResponse(
      'User standard quizzes fetched successfully.',
      result,
    );
  }
}
