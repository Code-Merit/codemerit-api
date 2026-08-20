import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionTopicService } from './providers/question-topic.service';
import { QuestionService } from './providers/question.service';
import { QuestionController } from './question.controller';
import { QuestionOptionService } from './providers/question-option.service';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionGeneratorService } from './providers/question-generator.service';
import { UserPermissionModule } from '../user-permission/user-permission.module';
import { MasterModule } from '../master/master.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, QuestionTopic, QuestionOption]),
    UserPermissionModule,
    MasterModule,
  ],
  providers: [
    QuestionService,
    QuestionTopicService,
    QuestionOptionService,
    QuestionGeneratorService,
  ],
  controllers: [QuestionController],
  exports: [
    QuestionService,
    QuestionOptionService,
    QuestionTopicService,
    QuestionGeneratorService,
  ],
})
export class QuestionModule {}
