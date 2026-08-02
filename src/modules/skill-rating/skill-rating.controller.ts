import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { SkillRatingService } from './providers/skill-rating.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse as ApiResponseDoc,
} from '@nestjs/swagger';
import { CreateAssessmentSessionDto } from './dtos/create-assessment-session.dto';
import { ApiResponse } from 'src/common/utils/api-response';

@ApiTags('Skill Ratings')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@UseGuards(AuthGuard('jwt')) // If using passport-jwt strategy
@Controller('apis/skill-ratings')
export class SkillRatingController {
  constructor(private readonly skillRatingService: SkillRatingService) {}

  @ApiOperation({
    summary: 'Create an assessment session with its skill ratings',
    description:
      'Records one round of skill ratings for a user — e.g. an SME rating a candidate during an ' +
      "interview, or a self-assessment. Creates the parent AssessmentSession plus every entry in " +
      "`skillRatings[]` (each rating 0-5, scoped to a SUBJECT or TOPIC skill) in a single transaction " +
      '— if any part fails, nothing is saved. `ratedBy` identifies who gave the ratings (omit for a ' +
      'self-assessment); `ratingType` distinguishes SELF vs QUIZ-derived ratings. This is a generic ' +
      "rating store, separate from the Interview module's own round submission flow.",
  })
  @Post()
  async create(
    @Body() dto: CreateAssessmentSessionDto,
  ): Promise<ApiResponse<any>> {
    console.log('dto', dto);
    const result = await this.skillRatingService.create(dto);
    return new ApiResponse(
      `${dto.assessmentTitle} added successfully.`,
      result,
    );
  }

  @ApiOperation({
    summary: 'List active skill metrics available for rating',
    description:
      'The full catalog of skill metrics an SME can score a candidate on during a round — used to ' +
      'render the rating form. Only currently-active metrics are returned.',
  })
  // Registered before ':id' — otherwise Nest would match this path as {id: 'skill-metrics'}.
  @Get('skill-metrics')
  async findSkillMetrics(): Promise<ApiResponse<any>> {
    const result = await this.skillRatingService.findActiveSkillMetrics();
    return new ApiResponse('Skill metrics fetched successfully', result);
  }

  @ApiOperation({
    summary: 'Get one assessment session by id, with named skill breakdown',
    description:
      'Returns the session plus each skill rating resolved to a human-readable `skillName` (looked ' +
      'up from the Subject or Topic table depending on `skillType`) instead of just a raw `skillId`. ' +
      "400 if the id doesn't exist.",
  })
  @ApiParam({ name: 'id', description: 'AssessmentSession id', type: Number })
  @ApiResponseDoc({
    status: 400,
    description: 'No assessment session exists with the given id.',
  })
  @Get(':id')
  async findOne(
    @Param(
      'id',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Id must be a valid number'),
      }),
    )
    id: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.skillRatingService.findAssessmentSession(id);
    return new ApiResponse('Assessment Found', result);
  }

  // @Get()
  // async findAll() {
  //   return this.skillRatingService.findAll();
  // }
  @ApiOperation({
    summary: 'List every assessment session recorded for a user',
    description:
      'Returns all sessions where this user was the one being rated (not the rater), each with its ' +
      'skill ratings resolved to human-readable names. 400 if the user has no sessions at all — this ' +
      'is not distinguished from an unknown userId.',
  })
  @ApiParam({ name: 'userId', description: 'User id being rated', type: Number })
  @ApiResponseDoc({
    status: 400,
    description: 'The user has no assessment sessions (or the id is unknown).',
  })
  @Get('user/:userId')
  async findByUserId(
    @Param(
      'userId',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('user id must be a valid number'),
      }),
    )
    userId: number,
  ) {
    return this.skillRatingService.findByUserId(userId);
  }

  @ApiOperation({
    summary: 'Delete an assessment session and its skill ratings',
    description:
      'Permanently removes the session; its skill ratings cascade with it. No confirmation step — ' +
      'callable by anyone authenticated, there is no ownership check on this endpoint.',
  })
  @ApiParam({ name: 'id', description: 'AssessmentSession id', type: Number })
  @Delete(':id')
  async remove(
    @Param(
      'id',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Id must be a valid number'),
      }),
    )
    id: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.skillRatingService.remove(id);
    return new ApiResponse(`Delete Successfully`, null);
  }
}
