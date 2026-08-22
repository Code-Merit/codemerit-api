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
  @Get('fetch/:slug')
  async findOne(@Param('slug') slug: string): Promise<ApiResponse<any>> {
    const result = await this.quizService.fetchQuizBySlug(slug);
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
  ): Promise<ApiResponse<any>> {
    // Use the validated DTO instance directly
    const result: any = await this.quizService.createQuiz(
      createQuizDto,
      createQuizDto.userId,
    );
    console.log('QuizCreateAPI #1 result', result);
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
      ipAddress: submitQuizDto.ipAddress ?? req.ip,
    });
    return new ApiResponse(`Quiz submitted successfully.`, result);
  }

  @ApiOperation({
    summary: 'Get Quiz Result',
    description: 'Retrieves the quiz result by a result code.',
  })
  @Public()
  @Get('result/:resultCode')
  async getQuizResultByCode(
    @Param('resultCode') resultCode: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.quizResultService.getQuizResultByCode(resultCode);
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
