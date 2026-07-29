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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CreateAssessmentSessionDto } from './dtos/create-assessment-session.dto';
import { ApiResponse } from 'src/common/utils/api-response';

@ApiTags('Skill Ratings')
@ApiBearerAuth('access-token') // Same name used in `addBearerAuth`
@UseGuards(AuthGuard('jwt')) // If using passport-jwt strategy
@Controller('apis/skill-ratings')
export class SkillRatingController {
  constructor(private readonly skillRatingService: SkillRatingService) {}

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

  // Registered before ':id' — otherwise Nest would match this path as {id: 'skill-metrics'}.
  @Get('skill-metrics')
  async findSkillMetrics(): Promise<ApiResponse<any>> {
    const result = await this.skillRatingService.findActiveSkillMetrics();
    return new ApiResponse('Skill metrics fetched successfully', result);
  }

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
