import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { ApiResponse } from 'src/common/utils/api-response';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { QuizService } from 'src/modules/quiz/providers/quiz.service';
import { CreateUserDto } from '../auth/dto/create-user.dto';
import { UpdateUserProfileDto } from './dtos/update-user-profile.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { UserProfileService } from './providers/user-profile.service';
import { UserProfileAggregatorService } from './providers/user-profile-aggregator.service';
import { UserService } from './providers/user.service';

@Controller('apis/users')
export class UsersController {
  constructor(
    private readonly usersService: UserService,
    private readonly userProfileService: UserProfileService,
    private readonly userProfileAggregatorService: UserProfileAggregatorService,
    private readonly quizService: QuizService,
  ) {}
  @Get('me')
  async getProfile(@Request() req): Promise<ApiResponse<any>> {
    const result = await this.usersService.getOwnUserInfo(req.user.id);
    if (result) {
      return new ApiResponse('User Found', result);
    }
    return new ApiResponse('User not found', result);
  }

  @Post('initial-assessment')
  async generateInitialAssessment(@Request() req): Promise<ApiResponse<any>> {
    const userId = req.user.id;
    const user = await this.usersService.findOne(userId);
    const jobRoleId = await this.usersService.getEarliestJobRoleId(userId);
    if (!jobRoleId) {
      throw new AppCustomException(
        400,
        'No job role selected — cannot generate an initial assessment.',
      );
    }
    const result = await this.quizService.createInitialAssessmentQuiz(
      userId,
      user.firstName,
      jobRoleId,
    );
    return new ApiResponse(result.message, result.quiz);
  }

  //View Profile API for Admin
  //create one more endpoint: /profile/{userName} like above end point that can be used by admin only
  //to view any user profile based on the username
  //Refer second last commit to check the profile entity
  //that lists the user profile along with the profile.
  //sensitive fields like password, token etc. should not be revealed.
  //the profile should be attached with login & in data.profile
  //Additional : Implement slugify use for username during registration. Existing utility in project. See usage.

  @Get()
  async getAllUsers(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.usersService.findUserList({
      id: req.user.id,
      role: req.user.role,
    });
    if (result && result.length > 0) {
      return new ApiResponse('Users listed successfully.', result);
    }
    return new ApiResponse('User not found.', null);
  }

  /** Admin/Talent-Partner-driven creation (the "Manage Users" add-user form) — distinct from
   * public self-signup (`POST /auth/register`). `createdBy` is stamped from the authenticated
   * caller here, not from the request body, so it's trustworthy enough to gate "users I added"
   * (findUserList's Talent-Partner filter, updateUser's ownership check). */
  @Post()
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.usersService.createUserByPrivilegedCaller(
      { id: req.user.id, role: req.user.role },
      createUserDto,
    );
    return new ApiResponse('User created successfully.', result);
  }

  // @UseGuards(RolesGuard)
  // @Roles(UserRoleEnum.ADMIN)
  @Get('profile/:username')
  async getUserByUsername(
    @Param('username') username: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.userProfileAggregatorService.getFullProfile(username);
    return new ApiResponse('User found.', result);
  }
  @Put('update')
  async updateUser(
    @Query('userId', ParseIntPipe) userId: number,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.usersService.updateUser(userId, updateUserDto, {
      id: req.user.id,
      role: req.user.role,
    });
    return new ApiResponse('User profile updated successfully.', result);
  }

  @Put('/profile-update/:id')
  async updateUserProfile(
    @Query('id', ParseIntPipe) id: number,
    @Body() updateProfileDto: UpdateUserProfileDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.userProfileService.updateProfile(
      id,
      updateProfileDto,
    );
    return new ApiResponse('User profile updated successfully.', result);
  }

  @Put('jobRoleEnrollment')
  async enrollJobRole(
    @Request() req,
    @Body() dto: { jobRoleId: number },
  ): Promise<ApiResponse<any>> {
    const result = await this.usersService.enrollJobRole(
      req.user.id,
      dto.jobRoleId,
    );
    return new ApiResponse('User enrolled in job role successfully.', result);
  }

  @Put('change-password')
  async changePassword(
    @Request() req,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.usersService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return new ApiResponse('Password updated successfully.', result);
  }

  // @Get(':userId')
  // async findOne(
  //   @Param(
  //     'userId',
  //     new ParseIntPipe({
  //       errorHttpStatusCode: 400,
  //       exceptionFactory: () =>
  //         new BadRequestException('User Id must be a valid number'),
  //     }),
  //   )
  //   userId: number,
  // ): Promise<ApiResponse<any>> {
  //   const result = await this.usersService.findOne(userId);
  //   if (result) {
  //     return new ApiResponse('User Found', result);
  //   } else {
  //     return new ApiResponse('User Found', result);
  //   }
  // }

  @Delete('delete/:userId')
  async remove(
    @Query('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.usersService.remove(userId, { id: req.user.id, role: req.user.role });
    return new ApiResponse('User deleted Successful.', null);
  }
}
