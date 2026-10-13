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
import { QuizService } from './providers/quiz.service';
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
    description: 'Fetches a quiz detail and asked quiz questions ',
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
    // Standard quizzes land in the curated public `quiz` catalog (and can be created
    // already-published) — staff only. Checked here rather than via @Roles because the
    // same route also serves every learner's self-directed UserQuiz.
    if (
      createQuizDto.quizType === QuizTypeEnum.Standard &&
      ![UserRoleEnum.ADMIN, UserRoleEnum.MODERATOR].includes(req.user?.role)
    ) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'Only admins can create Standard quizzes.',
      );
    }

    // Never trust a client-supplied userId — it drives both quiz ownership and the
    // enrollment/daily-cap gate, so a forged one would let any user borrow another
    // user's (e.g. Pro) entitlements. Always attribute to the authenticated caller.
    const result: any = await this.quizService.createQuiz(
      { ...createQuizDto, userId: req.user.id },
      req.user.id,
    );
    return new ApiResponse(`${result?.message}`, result?.quiz);
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

    // Never trust a client-supplied userId — the achievement layer (XP, badges,
    // certificates) makes forging another user's submission a real fraud vector,
    // not just a data-quality nuisance. Always attribute to the authenticated caller.
    const result = await this.quizService.submitQuiz({
      ...submitQuizDto,
      userId: req.user.id,
      // Server-observed only — a client-reported IP is unverifiable by definition.
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
    let quizzesWithTaken;
    if (req.user && req.user.id) {
      const userId = req.user.id;
      const quizIds = result.map((quiz: any) => quiz.id);
      const resultCodeMap = await this.quizResultService.findAllResultCodesByUserAndQuizIds(
        userId,
        quizIds,
      );

      quizzesWithTaken = result.map((quiz: any) => {
        const resultCodes = resultCodeMap[quiz.id] ?? [];
        return {
          ...quiz,
          isQuizTaken: Boolean(resultCodes.length),
          resultCodes,
          latestResultCode: resultCodes[0] ?? null,
        };
      });
    } else {
      quizzesWithTaken = result.map((quiz: any) => ({
        ...quiz,
        isQuizTaken: false,
        resultCodes: [],
        latestResultCode: null,
      }));
    }
    return new ApiResponse(
      'Published quizzes fetched successfully',
      quizzesWithTaken,
    );
  }

  @ApiOperation({
    summary: 'Get my practice quizzes',
    description:
      'Every practice quiz (UserQuiz) the authenticated caller has generated for ' +
      'themselves, each with question/attempt counts and a link to the latest ' +
      'result if taken. Always scoped to the authenticated caller, never a ' +
      'client-supplied id — distinct from GET /:userId below, which lists ' +
      'Standard quizzes a user authored.',
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
  })
  @Get('/:userId')
  async getUserQuizzes(
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const isAdmin = req.user?.role === 'Admin';
    const result = await this.quizService.getUserQuizzes(Number(userId), isAdmin);
    return new ApiResponse('User quizzes fetched successfully', result);
  }

}
