import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiResponse } from 'src/common/utils/api-response';
import { CreateInterviewDto } from './dtos/create-interview.dto';
import { InterviewService } from './providers/interview.service';
import {
  Put,
  Get,
  Param,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { UpdateInterviewDto } from './dtos/update-interview.dto';
import { SubmitInterviewDto } from './dtos/submit-interview.dto';
import { AssignInterviewDto } from './dtos/assign-interview.dto';
import { CancelInterviewDto } from './dtos/cancel-interview.dto';
import { FinalizeInterviewDto } from './dtos/finalize-interview.dto';
import { InterviewManagerGuard } from 'src/common/policies/interview-manager.guard';
import { OptionalJwtAuthGuard } from 'src/core/auth/jwt/optional-jwt-auth-guard';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Interviews')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@Controller('apis/interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async createInterview(
    @Body() dto: CreateInterviewDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.createInterview(dto);

    return new ApiResponse('Interview created successfully', result);
  }

  @UseGuards(InterviewManagerGuard)
  @Put(':id')
  async updateInterview(
    @Param('id', ParseIntPipe) interviewId: number, // Explicit variable name
    @Body() dto: UpdateInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.updateInterview(
      interviewId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Interview updated successfully', result);
  }

  @UseGuards(InterviewManagerGuard)
  @Put(':id/assign')
  async assignInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Body() dto: AssignInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.assignInterview(
      interviewId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Round assigned successfully', result);
  }

  @UseGuards(InterviewManagerGuard)
  @Put(':id/rounds/:sessionId/cancel')
  async cancelRound(
    @Param('id', ParseIntPipe) interviewId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: CancelInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.cancelRound(
      interviewId,
      sessionId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Round cancelled successfully', result);
  }

  // No InterviewManagerGuard here on purpose — the owning candidate can cancel their own
  // interview too; cancelInterview() itself enforces "owner OR privileged". Still requires
  // login via the global JwtAuthGuard.
  @Put(':id/cancel')
  async cancelInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Body() dto: CancelInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.cancelInterview(
      interviewId,
      dto,
      req.user,
    );
    return new ApiResponse('Interview cancelled successfully', result);
  }

  @UseGuards(InterviewManagerGuard)
  @Put(':id/finalize')
  async finalizeInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Body() dto: FinalizeInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.finalizeInterview(
      interviewId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Interview finalized successfully', result);
  }

  @Put(':id/rounds/:sessionId/start')
  async startInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.startInterview(
      interviewId,
      sessionId,
      req.user.id,
    );
    return new ApiResponse('Round started successfully', result);
  }

  @Put(':id/rounds/:sessionId/submit')
  async submitInterview(
    @Param('id', ParseIntPipe) interviewId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: SubmitInterviewDto,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.submitInterview(
      interviewId,
      sessionId,
      dto,
      req.user.id,
    );
    return new ApiResponse('Round submitted successfully', result);
  }

  // Registered before ':interviewCode' — otherwise Nest would match this path
  // as {interviewCode: 'sme-directory'}.
  @UseGuards(InterviewManagerGuard)
  @Get('sme-directory')
  async getSmeDirectory(): Promise<ApiResponse<any>> {
    const result = await this.interviewService.getSmeDirectory();
    return new ApiResponse('SME directory fetched successfully', result);
  }

  @Get(':interviewCode')
  async getInterviewDetails(
    @Param('interviewCode') interviewCode: string,
    @Req() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.getInterviewDetails(
      interviewCode,
      req.user,
    );

    return new ApiResponse('Interview details fetched successfully', result);
  }

  @Get()
  async getInterviews(
    @Query('userId', new DefaultValuePipe(0), ParseIntPipe)
    userId: number,

    @Query('fetchAll', new DefaultValuePipe(false), ParseBoolPipe)
    fetchAll: boolean,

    @Query('interviewerId', new DefaultValuePipe(0), ParseIntPipe)
    interviewerId: number,

    @Query('when') when?: 'upcoming' | 'past',

    @Query('status') status?: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.interviewService.getInterviews(
      userId,
      fetchAll,
      interviewerId || undefined,
      when,
      status,
    );

    return new ApiResponse('Interviews fetched successfully', result);
  }
}
