import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './providers/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { OptionalJwtAuthGuard } from './jwt/optional-jwt-auth-guard';
import { AccountVerificationDto } from './dto/account-verification.dto';
import { UserService } from '../users/providers/user.service';
import { UserOtpTagsEnum } from '../users/enums/user-otp-Tags.enum';
import { ApiResponse } from 'src/common/utils/api-response';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { User } from 'src/common/typeorm/entities/user.entity';
import { LoginResponseDto } from './dto/login-response.dto';
import { LinkedinCallbackDto } from 'src/modules/auth/dtos/linkedin-callback.dto';
import { GoogleCallbackDto } from 'src/modules/auth/dtos/google-callback.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';

@ApiTags('Auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UserService,
  ) {}

  @ApiOperation({
    summary: 'Log in / register via a LinkedIn OAuth code (public)',
    description:
      'Exchanges the LinkedIn authorization `code` for an access token, fetches the LinkedIn ' +
      'profile, then either links that LinkedIn id to an existing account matched by email ' +
      '(reactivating it to ACTIVE if it was pending/blocked) or silently creates a brand-new, ' +
      'already-ACTIVE account with a random unusable password. Either way it completes a full ' +
      'login and returns a signed JWT plus profile/permissions/course-stats in the response, ' +
      'exactly like `POST /auth/login`. A LinkedIn API failure surfaces as a 400.',
  })
  @Post('linkedin/callback')
  @HttpCode(HttpStatus.OK)
  async linkedinCallback(
    @Body() linkedinCallbackDto: LinkedinCallbackDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.authService.handleLinkedinCallback(
      linkedinCallbackDto.code,
    );
    return new ApiResponse('LinkedIn authentication evaluated', result);
  }

  @ApiOperation({
    summary: 'Log in / register via a Google ID token (public)',
    description:
      'Verifies the Google `idToken` against Google\'s own client id, then either links the Google ' +
      'account to an existing user matched by email (reactivating it to ACTIVE if not already) or ' +
      'creates a brand-new, already-ACTIVE account with a random unusable password. Either way it ' +
      'completes a full login and returns a signed JWT plus profile/permissions/course-stats, same ' +
      'shape as `POST /auth/login`. Rejects with 400 if the token is invalid/unverifiable or the ' +
      'Google account has no e-mail on it.',
  })
  @ApiResponseDoc({
    status: 400,
    description: 'Invalid/unverifiable Google idToken, or the Google account has no e-mail address.',
  })
  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  async googleCallback(
    @Body() googleCallbackDto: GoogleCallbackDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.authService.handleGoogleCallback(
      googleCallbackDto.idToken,
    );
    return new ApiResponse('Google authentication evaluated', result);
  }

  /** Still fully public — self-signup never carries a token — but OptionalJwtAuthGuard also
   * inspects one if the caller happens to send it (the admin-panel "add user" form, flow ===
   * 'UserRegistration'), so `createdBy` can be the verified caller's own id rather than anything
   * client-supplied in the body. See AuthService.signup for where that's actually used. */
  @ApiOperation({
    summary: 'Self-register a new account (public)',
    description:
      'Creates the User + Profile (and, if `techRoleId`/`jobRoleId` is given, an initial ' +
      'UserJobRole enrollment) in one transaction. Rejects with 400 if the e-mail (or the mobile, ' +
      'when supplied) is already registered. Social sign-ups (`auth_provider` Google/LinkedIn) are ' +
      'created already ACTIVE with an e-mail-verified notice; native sign-ups are created PENDING ' +
      'and get a 6-digit OTP e-mailed for `POST /auth/verify` before they can log in. ' +
      '`flow: \'QuickRegistration\'` additionally auto-logs-in and returns a JWT straight away — ' +
      'every other flow just returns the created user with no token. `flow: \'UserRegistration\'` ' +
      "(the admin-panel add-user form) is the only case where an attached bearer token's own id " +
      'is honored as `createdBy`; a token on any other flow is ignored.',
  })
  @Post('register')
  @UseGuards(OptionalJwtAuthGuard)
  async signup(
    @Body() createUserDto: CreateUserDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.authService.signup(createUserDto, req.user?.id);
    if (
      createUserDto.flow &&
      createUserDto.flow === 'QuickRegistration' &&
      !(result instanceof LoginResponseDto || 'token' in result)
    ) {
      const resultWithToken = await this.authService.autoLogin(result as User);
      return new ApiResponse('Succesfully Registered', resultWithToken);
    }
    return new ApiResponse('Succesfully Registered', result);
  }

  @ApiOperation({
    summary: 'Log in with e-mail + password (public)',
    description:
      'Authenticated by `LocalAuthGuard` (bcrypt-compares the password before this handler even ' +
      'runs) — a bad e-mail or password never reaches here, it 400s from the guard\'s own ' +
      'validation. Rejects with 403 if the matched account is BLOCKED, or if it is not yet ACTIVE ' +
      '(still pending e-mail OTP verification). On success, signs and returns a JWT plus the full ' +
      'profile, granted permissions, job-role enrollments, course/quiz stats and API-usage counters ' +
      'in one payload — the same shape every OAuth callback below also returns.',
  })
  @ApiResponseDoc({
    status: 403,
    description: 'Account is BLOCKED, or not yet ACTIVE (pending OTP verification).',
  })
  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(
    @Request() req,
    @Body() body: LoginDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.authService.login(req.user);
    return new ApiResponse('Succesfully Logged In', result);
  }

  @ApiOperation({
    summary: 'Send a fresh OTP e-mail for a given purpose (public)',
    description:
      'Generates a new 6-digit OTP and e-mails it to `email`, tagged with `tag` (e.g. ACC_VERIFY, ' +
      'PWD_RECOVER — see UserOtpTagsEnum). Rejects with 400 if the e-mail is not registered, or if ' +
      'the account is already ACTIVE and `tag` is ACC_VERIFY (nothing left to verify). Does not ' +
      'invalidate any OTP previously sent for the same tag — verification always checks the most ' +
      'recently created one.',
  })
  @Post('sent-otp')
  async sendOtp(@Body() query: SendOtpDto): Promise<ApiResponse<any>> {
    const result = await this.usersService.sendOtp(
      query.email,
      null,
      query.tag,
    );
    return new ApiResponse('OTP sent succesfully.', result);
  }

  @ApiOperation({
    summary: 'Verify an OTP and activate the account (public)',
    description:
      'Matches `otp` against the most recently created OTP row for `email`+`tag`; on a match, marks ' +
      'that OTP used and — for `tag: ACC_VERIFY` — flips the account to ACTIVE, sends an ' +
      'account-verified e-mail, and logs an activity entry. Rejects with 400 on any mismatch/unknown ' +
      'e-mail. This same handler also powers `tag: PWD_RECOVER` (see `/auth/recover-password` below) ' +
      'since both routes call the identical service method — the `tag` field in the body, not the ' +
      'URL, decides which business rule actually runs.',
  })
  @Post('verify')
  async acoountVerification(
    @Body()
    accountVerificationDto: AccountVerificationDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.usersService.acoountVerification(
      accountVerificationDto,
    );
    return new ApiResponse('Account verified succesfully.', result);
  }

  @ApiOperation({
    summary: 'Complete a forgot-password reset with an OTP (public)',
    description:
      'Functionally identical handler to `POST /auth/verify` — pass `tag: PWD_RECOVER` and the new ' +
      '`password` in the body alongside the OTP obtained from `POST /auth/sent-otp`. On a correct, ' +
      'unused OTP the account password is replaced, a password-changed e-mail is sent, and an ' +
      'activity entry is logged. Rejects with 400 on OTP mismatch or an unrecognized e-mail.',
  })
  @Post('recover-password')
  async recoverPassword(
    @Body()
    recoverPassword: AccountVerificationDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.usersService.acoountVerification(recoverPassword);
    return new ApiResponse('Succesfully Recovered Password', result);
  }
}
