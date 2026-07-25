import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/core/auth/jwt/optional-jwt-auth-guard';
import { AddUserSubjectsDto } from 'src/core/users/dtos/user-subject.dto';
import { ApiResponse } from 'src/common/utils/api-response';
import { UserPermissionService } from '../user-permission/providers/user-permission.service';
import { MasterService } from './providers/master.service';
import { TopicAnalysisService } from './providers/topic-analysis.service';
import { SubjectStatsService } from './providers/subject-stats.service';
import { ProgramService } from './providers/program.service';
import { MeritService } from './providers/merit.service';

@Controller('apis/master')
export class MasterController {
  constructor(
    private readonly masterService: MasterService,
    private readonly subjectStats: SubjectStatsService,
    private readonly programService: ProgramService,
    private readonly topicAnalysisProvider: TopicAnalysisService,
    private readonly userPermissionService: UserPermissionService,
    private readonly meritService: MeritService,
  ) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('data')
  async getMasterData(@Request() req: any) {
    const userId = req.user?.id;
    return this.masterService.getMasterData(userId);
  }

  @Post('userSubjects')
  async addUserSubjects(@Request() req, @Body() dto: AddUserSubjectsDto) {
    const userId = req.user.id;
    return this.masterService.addUserSubjects(userId, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('subjectDashboard')
  async getSubjectDashboard(@Query('slug') slug: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.subjectStats.getSubjectPage(slug, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('subjectTopicsDashboard')
  async subjectTopicsDashboard(
    @Query('subjectId') subjectId?: string,
    @Request() req?: any,
  ) {
    const subjectIdNum = subjectId ? parseInt(subjectId, 10) : undefined;
    if (subjectIdNum && subjectIdNum > 0) {
      return this.topicAnalysisProvider.getTopicStatsBySubject(subjectIdNum, req.user);
    }
    return this.topicAnalysisProvider.getAllTopicStats(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('myCareerDashboard')
  async getCareerDashboard(@Request() req: any) {
    return this.programService.getCareerDashboard(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('career-dashboard')
  async getEnrichedCareerDashboard(@Request() req: any) {
    return this.programService.getEnrichedCareerDashboard(req.user.id);
  }

  @Get('userQuizStats')
  async getUserStats(@Request() req) {
    const userId = req.user?.id;
    return this.masterService.getUserQuizStats(userId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('routes')
  async getRoutes(@Request() req: any) {
    const permissions = await this.userPermissionService.findUserPermissionList(req.user?.id);
    const result = await this.masterService.getRoutesConfig(req.user?.role, permissions);
    return new ApiResponse('Routes fetched successfully.', result);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('programDetails/:programSlug')
  async getProgramDetails(@Param('programSlug') programSlug: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.programService.getProgramDetails(programSlug, userId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('leaderboard')
  async getGlobalLeaderboard(
    @Query('period') period: 'all-time' | 'weekly' | 'monthly' = 'all-time',
    @Request() req?: any,
  ) {
    const userId = req?.user?.id;
    const resolvedPeriod = ['weekly', 'monthly'].includes(period) ? period : 'all-time';
    return this.meritService.getGlobalXpLeaderboard(userId, 10, resolvedPeriod);
  }
}
