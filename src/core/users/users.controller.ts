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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('apis/users')
export class UsersController {
  constructor(
    private readonly usersService: UserService,
    private readonly userProfileService: UserProfileService,
    private readonly userProfileAggregatorService: UserProfileAggregatorService,
    private readonly quizService: QuizService,
  ) {}

  @ApiOperation({
    summary: "Get the caller's own profile",
    description:
      "Resolves the user purely from the verified JWT (`req.user.id`) — there is no id parameter, " +
      "so this can never read anyone else's data. Bundles the base user row with their Profile " +
      "(bio, social links, self-rating/interview flags) and their full granted-permission list. " +
      "Returns a 200 with `null` data (not a 404) if the account row is somehow missing.",
  })
  @Get('me')
  async getProfile(@Request() req): Promise<ApiResponse<any>> {
    const result = await this.usersService.getOwnUserInfo(req.user.id);
    if (result) {
      return new ApiResponse('User Found', result);
    }
    return new ApiResponse('User not found', result);
  }

  @ApiOperation({
    summary: 'Generate (or fetch) the caller\'s one-time initial assessment quiz',
    description:
      'Idempotent — if an initial-assessment quiz already exists for this user it is returned as-is ' +
      'instead of generating a duplicate. Otherwise builds a new 20-question UserQuiz sourced from ' +
      'every subject attached to the caller\'s earliest job-role enrollment. Rejects with 400 if the ' +
      'caller has never enrolled in a job role, or if that job role has no subjects configured yet.',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Caller has no job-role enrollment, or the enrolled job role has no subjects configured.',
  })
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

  @ApiOperation({
    summary: 'List manageable users (Admin or Talent Partner only)',
    description:
      'Admins get every user in the system; a Talent Partner (permission `Role:TalentPartner`) only ' +
      "sees users they personally created (`createdBy`) — 403 for anyone with neither. Each row is " +
      'annotated with job-role titles, and quiz/assessment/API-usage counts aggregated with cheap ' +
      'grouped queries rather than a fan-out join. Returns `data: null` (not an empty array) when ' +
      'the caller manages nobody yet.',
  })
  @ApiResponseDoc({
    status: 403,
    description: 'Caller is neither an Admin nor a Talent-Partner-permission holder.',
  })
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
  @ApiOperation({
    summary: 'Create a user on someone else\'s behalf (Admin or Talent Partner only)',
    description:
      'The "Manage Users" add-user form — distinct from public self-signup (`POST /auth/register`). ' +
      '403 for callers who are neither Admin nor a Talent-Partner-permission holder. `createdBy` is ' +
      "always stamped from the authenticated caller's own id (never the request body), which is " +
      'what later lets a Talent Partner only edit/list the users they personally added. Same ' +
      'underlying account-creation rules as self-signup apply: 400 on a duplicate e-mail/mobile, an ' +
      'OTP e-mail goes out for native accounts.',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'E-mail (or mobile, if supplied) is already registered to another account.',
  })
  @ApiResponseDoc({
    status: 403,
    description: 'Caller is neither an Admin nor a Talent-Partner-permission holder.',
  })
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
  @ApiOperation({
    summary: 'Get a user\'s full public-facing profile by username',
    description:
      'Aggregates the user row with course dashboards, granted permissions, the 10 most recent quiz ' +
      'results (with score/avg summary), self- and interview-assessment sessions (5 most recent of ' +
      'each, with skill ratings + avg summary), issued certificates, earned badges (subject/global), ' +
      'the last 20 activity entries, and gamification (points/level/streak). No role check is ' +
      'currently enforced beyond being logged in — this is the same aggregator used to render any ' +
      'user\'s public profile page. Throws 400 if the username does not exist.',
  })
  @ApiParam({ name: 'username', description: 'Target user\'s username (not id)', type: String })
  @Get('profile/:username')
  async getUserByUsername(
    @Param('username') username: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.userProfileAggregatorService.getFullProfile(username);
    return new ApiResponse('User found.', result);
  }
  @ApiOperation({
    summary: 'Update a user\'s core account fields (Admin or Talent Partner only)',
    description:
      'A Talent Partner may only edit users they personally created (`createdBy` match) and only ' +
      'while that user is not yet ACTIVE — 403 otherwise — and may never change `accountStatus` or ' +
      '`role` (403 if attempted); Admins have no such restrictions. Passing `linkedinUrl` also ' +
      'upserts the user\'s Profile row (creating one if it does not exist yet) alongside the base ' +
      'user fields.',
  })
  @ApiQuery({ name: 'userId', required: true, type: Number, description: 'Id of the user to update.' })
  @ApiResponseDoc({
    status: 403,
    description:
      'Caller lacks Manage-Users permission, or a Talent Partner tried to edit a user they did not ' +
      'create, edit an already-ACTIVE user, or change accountStatus/role.',
  })
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

  @ApiOperation({
    summary: "Update the caller's own Profile fields",
    description:
      "Resolves the profile purely from the verified JWT (`req.user.id`) — there is no id " +
      "parameter, so this can never update anyone else's profile. Only the fields present on " +
      '`UpdateUserProfileDto` (linkedinUrl, about, social ids, workStatus, and the ' +
      'workStatus-dependent education fields [collegeName, stream, passingYear, ' +
      'hasCompletedInternship, internshipDuration] or experience fields [experience, ' +
      'isCurrentlyEmployed, companyName]) are merged in; rejects with 400 if no Profile row ' +
      "exists for the caller. This is a partial patch: when `workStatus` is included in the " +
      'request, its full set of dependent fields for that branch must be included too (all ' +
      'required together), and the fields belonging to the other branch must be omitted. ' +
      'Omitting `workStatus` entirely leaves existing values untouched. Submitting `workStatus` ' +
      '(with its required branch fields) also flips `profileCompleted` to true on the returned ' +
      'profile — a server-managed flag frontend can check (here, on `GET /apis/users/me`, or in ' +
      'the login response) to know whether this post-registration form still needs to be shown.',
  })
  @Put('/profile-update')
  async updateUserProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateUserProfileDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.userProfileService.updateProfile(
      req.user.id,
      updateProfileDto,
    );
    return new ApiResponse('User profile updated successfully.', result);
  }

  @ApiOperation({
    summary: 'Enroll the caller in a job role',
    description:
      'Enrolls the authenticated caller (never a client-supplied user id) in `jobRoleId`. Rejects ' +
      'with 404 if the job role does not exist, or 409 if the caller is already enrolled in it — ' +
      'enrollments are not deduplicated silently. Sends an in-app notification confirming the ' +
      'enrollment. The very first job role a user ever enrolls in also drives which subjects ' +
      '`POST /apis/users/initial-assessment` builds its quiz from.',
  })
  @ApiResponseDoc({ status: 404, description: 'Job role does not exist.' })
  @ApiResponseDoc({ status: 409, description: 'Caller is already enrolled in this job role.' })
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

  @ApiOperation({
    summary: 'Change the caller\'s own password',
    description:
      'Requires `currentPassword` to bcrypt-match the stored hash — 400 if it does not. Also 400s ' +
      'if `newPassword` equals `currentPassword`, or equals the already-stored hash (i.e. no actual ' +
      'change). On success, sends a password-changed confirmation e-mail and logs an activity entry ' +
      '(both best-effort — failures are logged server-side but do not fail the request).',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Current password is incorrect, or the new password is not actually different.',
  })
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

  @ApiOperation({
    summary: 'Delete a user (Admin only)',
    description:
      '403 for any non-Admin caller. Not a hard delete: the target is first flipped to BLOCKED, its ' +
      'Profile row is removed, then the user row itself is soft-deleted (`softDelete`, recoverable ' +
      'at the DB level, excluded from normal queries going forward). Note: although the route path ' +
      'carries `:userId`, the handler actually reads the id from the `userId` query-string ' +
      'parameter, not the path segment — pass it both places to be safe. Rejects with 400 if no ' +
      'user with that id exists.',
  })
  @ApiParam({ name: 'userId', description: 'Present in the route but not actually read — see description.', type: Number })
  @ApiQuery({ name: 'userId', required: true, type: Number, description: 'Id of the user to delete — this is the value actually used.' })
  @ApiResponseDoc({ status: 403, description: 'Caller is not an Admin.' })
  @Delete('delete/:userId')
  async remove(
    @Query('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    await this.usersService.remove(userId, { id: req.user.id, role: req.user.role });
    return new ApiResponse('User deleted Successful.', null);
  }
}
