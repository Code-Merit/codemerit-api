import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponse } from 'src/common/utils/api-response';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { CreateQuizDto } from './dtos/create-quiz.dto';
import { UpdateQuizDto } from './dtos/update-quiz.dto';
import { SubmitQuizDto } from './dtos/submit-quiz.dto';
import { INITIAL_ASSESSMENT_TAG, QuizService } from './providers/quiz.service';
import { QuizResultService } from './providers/quiz-result.service';
import { ApiOperation } from '@nestjs/swagger';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { PublishedQuizFilterDto } from './dtos/published-quiz.dto';
import { OptionalJwtAuthGuard } from 'src/core/auth/jwt/optional-jwt-auth-guard';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';

@Controller('apis/quiz')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly quizResultService: QuizResultService,
  ) { }

  @Public()
  @ApiOperation({
    summary: 'Fetch one quiz by slug',
    description: 'Quiz details with its questions.',
  })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('fetch/:slug')
  async findOne(
    @Param('slug') slug: string,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.quizService.fetchQuizBySlug(slug, req.user?.id);
    return new ApiResponse('Question Found', result);
  }

  @ApiOperation({
    summary: 'Create New Quiz',
    description:
      'Creates a new quiz (User Quiz or Standard Quiz) along with questions.',
  })
  @Post('create')
  async create(
    @Body() createQuizDto: CreateQuizDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    // Standard (catalog) quizzes are staff-only. Not via @Roles, since learners use
    // this same route for practice quizzes.
    if (
      createQuizDto.quizType === QuizTypeEnum.Standard &&
      ![UserRoleEnum.ADMIN, UserRoleEnum.MODERATOR].includes(req.user?.role)
    ) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'Only admins can create Standard quizzes.',
      );
    }

    // Reserved for the system-generated onboarding quiz; letting a client set it would
    // shadow the real one (createInitialAssessmentQuiz is idempotent on this tag).
    if (createQuizDto.tag === INITIAL_ASSESSMENT_TAG) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'This tag is reserved.');
    }

    // Always the authenticated caller — userId drives ownership and entitlement checks.
    const result = await this.quizService.createQuiz(
      { ...createQuizDto, userId: req.user.id },
      req.user.id,
    );
    return new ApiResponse(result.message, result.quiz);
  }

  @ApiOperation({
    summary: 'Submit Quiz',
    description: 'Accepts submission from a user and captures attempt details.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Post('submit')
  async submitQuiz(
    @Body() submitQuizDto: SubmitQuizDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    if (!req?.user?.id) {
      throw new AppCustomException(
        HttpStatus.UNAUTHORIZED,
        'User not authenticated.',
      );
    }

    // userId and IP come from the server, never the client.
    const result = await this.quizService.submitQuiz({
      ...submitQuizDto,
      userId: req.user.id,
      ipAddress: req.ip,
    });
    return new ApiResponse(`Quiz submitted successfully.`, result);
  }

  @ApiOperation({
    summary: 'Get Quiz Result',
    description: 'Retrieves the quiz result by a result code.',
  })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('result/:resultCode')
  async getQuizResultByCode(
    @Param('resultCode') resultCode: string,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.quizResultService.getQuizResultByCode(resultCode, req.user?.id);
    return new ApiResponse('Quiz Result Found', result);
  }

  @ApiOperation({
    summary: 'Update a Standard Quiz',
    description:
      'Updates an existing Standard quiz with new questions, subjects, topics, and settings.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Put('update/:quizId')
  async updateQuiz(
    @Param('quizId', ParseIntPipe) quizId: number,
    @Body() updateQuizDto: UpdateQuizDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    if (!req?.user?.id) {
      throw new AppCustomException(
        HttpStatus.UNAUTHORIZED,
        'User not authenticated.',
      );
    }

    const result = await this.quizService.updateQuiz(
      quizId,
      updateQuizDto,
      req.user.id,
    );
    return new ApiResponse('Quiz updated successfully', result);
  }

  @ApiOperation({
    summary: 'Get all Standard published quizzes with questions and settings',
  })
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('quizzes')
  async getPublishedQuizzes(
    @Query() filters: PublishedQuizFilterDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.quizService.getPublishedQuizzes(filters);
    const resultCodeMap = req.user?.id
      ? await this.quizResultService.findAllResultCodesByUserAndQuizIds(
          req.user.id,
          result.map((quiz: any) => quiz.id),
        )
      : {};
    const quizzesWithTaken = result.map((quiz: any) => {
      const resultCodes = resultCodeMap[quiz.id] ?? [];
      return {
        ...quiz,
        isQuizTaken: resultCodes.length > 0,
        resultCodes,
        latestResultCode: resultCodes[0] ?? null,
      };
    });
    return new ApiResponse(
      'Published quizzes fetched successfully',
      quizzesWithTaken,
    );
  }

  @ApiOperation({
    summary: 'Get my practice quizzes',
    description:
      'Practice quizzes (UserQuiz) the caller generated, with counts and their own ' +
      'latest result. Distinct from GET /:userId, which lists authored Standard quizzes.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMyPracticeQuizzes(@Request() req: any): Promise<ApiResponse<any>> {
    const result = await this.quizService.getMyPracticeQuizzes(req.user.id);
    return new ApiResponse('My quizzes fetched successfully', result);
  }

  @ApiOperation({
    summary: "Get the caller's practice-question quota for a subject today",
    description:
      'Read-only counterpart to the DAILY_QUOTA_EXCEEDED check enforced at quiz creation — ' +
      'for display (e.g. "X of Y practice questions left today"), not blocking.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('quota/subject/:subjectId')
  async getSubjectQuestionQuota(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.quizService.getSubjectQuestionQuota(req.user.id, subjectId);
    return new ApiResponse('Subject question quota fetched successfully', result);
  }

  @ApiOperation({
    summary: 'Get user created quizzes with attempt count',
    description: 'Standard quizzes the user authored, drafts included. Admins see every author\'s.',
  })
  @Get('/:userId')
  async getUserQuizzes(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const isAdmin = req.user?.role === UserRoleEnum.ADMIN;
    // Drafts are private to their author.
    if (!isAdmin && userId !== req.user?.id) {
      throw new AppCustomException(HttpStatus.FORBIDDEN, 'You can only view your own quizzes.');
    }
    const result = await this.quizService.getUserQuizzes(userId, isAdmin);
    return new ApiResponse('User quizzes fetched successfully', result);
  }
}
