import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseIntPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { TopicsService } from './providers/topics.service';
import { CreateTopicDto } from './dtos/create-topics.dto';
import { UpdateTopicDto } from './dtos/update-topics.dto';
import { ApiResponse } from 'src/common/utils/api-response';
import { Public } from 'src/core/auth/decorators/public.decorator';
import { RequirePermission } from 'src/common/policies/require-permission.decorator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from 'src/common/policies/permissions.guard';
import { UserPermissionEnum, UserPermissionTitleEnum } from 'src/common/policies/user-permission.enum';

@Controller('apis/topics')
export class TopicsController {
  constructor(private readonly topicService: TopicsService) { }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.TopicCreate, UserPermissionTitleEnum.Topic)
  @Post('create')
  async create(
    @Body() createTopicDto: CreateTopicDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.topicService.create(createTopicDto);
    return new ApiResponse(`${createTopicDto.title} added successfully.`, result);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.TopicGet, UserPermissionTitleEnum.Topic)
  @Get('/all')
  async findAll(): Promise<ApiResponse<any>> {
    const result = await this.topicService.findAll();
    return new ApiResponse('Topics Found', result);
  }

  @Get(':topicId')
  async findOne(
    @Param(
      'topicId',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Topic Id must be a valid number'),
      }),
    )
    topicId: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.topicService.findOne(topicId);
    return new ApiResponse('Topic Found', result);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.TopicUpdate, UserPermissionTitleEnum.Topic)
  @Put('update/:id')
  async update(
    @Param(
      'id',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Topic Id must be a valid number'),
      }),
    )
    topicId: number,
    @Body() updateTopicDto: UpdateTopicDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.topicService.update(topicId, updateTopicDto);
    return new ApiResponse(
      `${updateTopicDto.title} updated successfully.`,
      result,
    );
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(UserPermissionEnum.TopicDelete, UserPermissionTitleEnum.Topic)
  @Delete('delete/:id')
  async remove(
    @Param(
      'id',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Topic Id must be a valid number'),
      }),
    )
    topicId: number,
  ): Promise<ApiResponse<any>> {
    await this.topicService.remove(topicId);
    return new ApiResponse('Topic deleted.', null);
  }

  @Public()
  @Get(':subjectId')
  async findAllTopicListBySubjectId(
    @Param(
      'subjectId',
      new ParseIntPipe({
        errorHttpStatusCode: 400,
        exceptionFactory: () =>
          new BadRequestException('Subject Id must be a valid number'),
      }),
    )
    subjectId: number,
  ): Promise<ApiResponse<any>> {
    const result = await this.topicService.findAllBySubjectId(subjectId);
    return new ApiResponse(
      `${result.length} topics found in Subject ${result[0].subjectName}`,
      result,
    );
  }
}
