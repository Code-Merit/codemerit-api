import { HttpStatus, Injectable } from '@nestjs/common';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuizQuestion } from 'src/common/typeorm/entities/quiz-quesion.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { generateScore } from 'src/common/utils/common-functions';
import { DataSource } from 'typeorm';

@Injectable()
export class QuizResultService {
  constructor(
    private readonly dataSource: DataSource
  ) { }
  async getQuizResultByCode(resultCode: string) {
    // 1. Fetch base quiz + user + quiz result
    const base = await this.dataSource
      .createQueryBuilder(QuizResult, 'r')
      .select([
        'r.id',
        'r.resultCode',
        'r.quizId',
        'r.userId',
        'r.total',
        'r.correct',
        'r.wrong',
        'r.unanswered',
        'r.score',
        'r.remarks',
        'r.createdAt',
        'q.title',
        'q.description',
        'q.slug',
        'q.quizType',
        'u.id',
        'u.firstName',
        'u.lastName',
        'u.username',
      ])
      .innerJoin('r.quiz', 'q')
      .innerJoin('r.user', 'u')
      .where('r.resultCode = :resultCode', { resultCode })
      .getRawOne();

    if (!base) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'Result not found');
    }

    const quizId = base.r_quizId;
    const userId = base.r_userId;

    // 2. Fetch QuestionAttempts for this quiz + user
    const questionRows = await this.dataSource
      .createQueryBuilder(QuestionAttempt, 'qa')
      .select([
        'qa.id AS attemptId',
        'qa.selectedOption AS selectedOptionId',
        'q.id AS questionId',
        'q.question AS text',
        'q.subjectId AS subjectId',
        's.title AS subjectTitle',
        's.slug AS subjectSlug',
        's.image AS subjectImage',
        't.id AS topicId',
        't.title AS topicTitle',
        'qa.isSkipped AS isSkipped',
        'qa.isCorrect AS isCorrect',
      ])
      .innerJoin('qa.question', 'q')
      .innerJoin('q.subject', 's')
      .leftJoin('q.questionTopics', 'qt')
      .leftJoin('qt.topic', 't')
      .innerJoin(QuizQuestion, 'qq', 'qq.questionId = q.id AND qq.quizId = :quizId', { quizId })
      .where('qa.userId = :userId', { userId })
      .andWhere('qa.quizId = :quizId', { quizId })
      .getRawMany();

    // 3. Build questions array with options
    const uniqueQuestionRows = new Map<number, any>();
    questionRows.forEach((r) => {
      if (!uniqueQuestionRows.has(r.questionId)) {
        uniqueQuestionRows.set(r.questionId, r);
      }
    });

    const questions = await Promise.all(
      Array.from(uniqueQuestionRows.values()).map(async (r) => {
        const options = await this.dataSource
          .createQueryBuilder(QuestionOption, 'qo')
          .select(['qo.id AS id', 'qo.option AS text', 'qo.correct AS correct'])
          .where('qo.questionId = :questionId', { questionId: r.questionId })
          .getRawMany();


          const formattedOptions = options.map((o) => ({
  id: Number(o.id),
  text: o.text,
  correct: Boolean(o.correct),
  selected:
    Number(o.id) === Number(r.selectedOptionId),
}));

        return {
          id: r.questionId,
          text: r.text,
          options: formattedOptions,
          selectedOptionId: Number(r.selectedOptionId) ?? null,
          isSkipped: r.isSkipped ?? false,
          isCorrect: r.isCorrect ?? false,
          subjectId: r.subjectId,
          topicId: r.topicId,
        };
      })
    );

    // 4. Aggregate subjects
    const subjectsMap = new Map<number, any>();
    questionRows.forEach((r) => {
      if (!subjectsMap.has(r.subjectId)) {
        subjectsMap.set(r.subjectId, {
          id: r.subjectId,
          title: r.subjectTitle,
          slug: r.subjectSlug,
          image: r.subjectImage,
          asked: 0,
          answered: 0,
          correct: 0,
          wrong: 0,
        });
      }
      const sub = subjectsMap.get(r.subjectId);
      sub.asked += 1;
      if (r.isSkipped === false) sub.answered += 1;
      if (r.isCorrect === true) {
        sub.correct += 1;
      } else if (r.isSkipped === false && r.isCorrect === false) {
        sub.wrong += 1;
      }
    });

    // score/accuracy use generateScore()/the same "correct over asked" formula every other
    // scoring surface uses — denominator is `asked` (not `answered`), since a skipped
    // question is still a recorded attempt, matching computeAttemptMetrics's currentAccuracy.
    const subjects = Array.from(subjectsMap.values()).map((s) => ({
      ...s,
      score: generateScore(s.asked, s.correct, s.wrong),
      coverage: s.asked ? +((s.answered / s.asked) * 100).toFixed(1) : 0,
      accuracy: s.asked ? +((s.correct / s.asked) * 100).toFixed(1) : 0,
    }));

    // 5. Aggregate topics
    const topicsMap = new Map<number, any>();
    questionRows.forEach((r) => {
      if (!r.topicId) return; // some questions may not have a topic
      if (!topicsMap.has(r.topicId)) {
        topicsMap.set(r.topicId, {
          id: r.topicId,
          title: r.topicTitle,
          asked: 0,
          answered: 0,
          correct: 0,
          wrong: 0,
        });
      }
      const t = topicsMap.get(r.topicId);
      t.asked += 1;
      if (r.isSkipped === false) t.answered += 1;
      if (r.isCorrect === true) {
        t.correct += 1;
      } else if (r.isSkipped === false && r.isCorrect === false) {
        t.wrong += 1;
      }
    });

    const topics = Array.from(topicsMap.values()).map((t) => ({
      ...t,
      score: generateScore(t.asked, t.correct, t.wrong),
      coverage: t.asked ? +((t.answered / t.asked) * 100).toFixed(1) : 0,
      accuracy: t.asked ? +((t.correct / t.asked) * 100).toFixed(1) : 0,
    }));

    // 6. Final response
    return {
      resultCode: base.r_resultCode,
      score: Number(base.r_score) || 0,
      accuracy: base.r_total ? +((base.r_correct / base.r_total) * 100).toFixed(1) : 0,
      total: Number(base.r_total) || 0,
      correct: Number(base.r_correct) || 0,
      wrong: Number(base.r_wrong) || 0,
      unanswered: Number(base.r_unanswered) || 0,
      remarks: base.r_remarks ?? '',
      createdAt: base.r_createdAt,
      user: {
        id: base.u_id,
        firstName: base.u_firstName,
        lastName: base.u_lastName,
        username: base.u_username,
      },
      quiz: {
        id: base.r_quizId,
        title: base.q_title,
        description: base.q_description,
        slug: base.q_slug,
        quizType: base.q_quizType,
      },
      subjects,
      topics,
      questions,
    };
  }

  /**
   * Returns an array of quiz IDs that the user has taken.
   */
  async findQuizIdsTakenByUser(userId: number): Promise<number[]> {
    const rows = await this.dataSource
      .createQueryBuilder(QuizResult, 'qr')
      .select('qr.quizId', 'quizId')
      .where('qr.userId = :userId', { userId })
      .getRawMany();
    return rows.map((row) => row.quizId);
  }

  async findAllResultCodesByUserAndQuizIds(
    userId: number,
    quizIds: number[],
  ): Promise<Record<number, string[]>> {
    if (!quizIds || quizIds.length === 0) {
      return {};
    }

    const rows = await this.dataSource
      .createQueryBuilder(QuizResult, 'qr')
      .select(['qr.quizId AS quizId', 'qr.resultCode AS resultCode'])
      .where('qr.userId = :userId', { userId })
      .andWhere('qr.quizId IN (:...quizIds)', { quizIds })
      .orderBy('qr.createdAt', 'DESC')
      .getRawMany();

    return rows.reduce((map, row) => {
      const quizId = Number(row.quizId);
      if (!map[quizId]) {
        map[quizId] = [];
      }
      map[quizId].push(row.resultCode);
      return map;
    }, {} as Record<number, string[]>);
  }
}
