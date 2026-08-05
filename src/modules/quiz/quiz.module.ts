import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuizQuestion } from 'src/common/typeorm/entities/quiz-quesion.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { QuizSubject } from 'src/common/typeorm/entities/quiz-subject.entity';
import { QuizTopic } from 'src/common/typeorm/entities/quiz-topic.entity';
import { Quiz } from 'src/common/typeorm/entities/quiz.entity';
import { QuizSettings } from 'src/common/typeorm/entities/quiz-settings.entity';
import { MasterModule } from '../master/master.module';
import { NotificationModule } from '../notification/notification.module';
import { UserQuestionService } from '../question/providers/user-question.service';
import { QuestionModule } from '../question/question.module';
import { QuestionAttemptService } from './providers/question-attempt.service';
import { QuizResultService } from './providers/quiz-result.service';
import { QuizService } from './providers/quiz.service';
import { QuizController } from './quiz.controller';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { ActivityModule } from '../activity/activity.module';
import { AchievementModule } from '../achievement/achievement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quiz,
      QuestionAttempt,
      QuizResult,
      QuizQuestion,
      QuizSubject,
      QuizTopic,
      QuizSettings,
      Subject,
    ]),
    QuestionModule,
    MasterModule,
    NotificationModule,
    ActivityModule,
    AchievementModule,
  ],
  providers: [QuizService, QuestionAttemptService, QuizResultService],
  controllers: [QuizController],
  exports: [QuizService],
})
export class QuizModule {}
