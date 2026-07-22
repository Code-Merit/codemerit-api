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

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UserService,
  ) {}

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

  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(
    @Request() req,
    @Body() body: LoginDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.authService.login(req.user);
    return new ApiResponse('Succesfully Logged In', result);
  }

  @Post('sent-otp')
  async sendOtp(@Body() query: SendOtpDto): Promise<ApiResponse<any>> {
    const result = await this.usersService.sendOtp(
      query.email,
      null,
      query.tag,
    );
    return new ApiResponse('OTP sent succesfully.', result);
  }

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

  @Post('recover-password')
  async recoverPassword(
    @Body()
    recoverPassword: AccountVerificationDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.usersService.acoountVerification(recoverPassword);
    return new ApiResponse('Succesfully Recovered Password', result);
  }
}
