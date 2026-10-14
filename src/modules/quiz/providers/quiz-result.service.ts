import { HttpStatus, Injectable } from '@nestjs/common';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { generateScore } from 'src/common/utils/common-functions';
import { DataSource, SelectQueryBuilder } from 'typeorm';

@Injectable()
export class QuizResultService {
  constructor(
    private readonly dataSource: DataSource
  ) { }
  /** Public, shareable view of one result: exposes display name/username/avatar only —
   * never user ids, email, IP, device or client. `isOwner` flags the viewer's own result. */
  async getQuizResultByCode(resultCode: string, viewerId?: number) {
    // Exactly one of quiz/userQuiz matches; COALESCE picks it.
    const base = await this.dataSource
      .createQueryBuilder(QuizResult, 'r')
      .select([
        'r.id',
        'r.resultCode',
        'r.quizId',
        'r.userQuizId',
        'r.quizType',
        'r.userId',
        'r.total',
        'r.correct',
        'r.wrong',
        'r.unanswered',
        'r.score',
        'r.remarks',
        'r.feedback',
        'r.createdAt',
        'u.firstName',
        'u.lastName',
        'u.username',
        'u.image',
      ])
      .leftJoin('r.quiz', 'q')
      .leftJoin('r.userQuiz', 'uq')
      .addSelect('COALESCE(q.title, uq.title)', 'title')
      .addSelect('COALESCE(q.description, uq.description)', 'description')
      .addSelect('COALESCE(q.slug, uq.slug)', 'slug')
      .innerJoin('r.user', 'u')
      .where('r.resultCode = :resultCode', { resultCode })
      .getRawOne();

    if (!base) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'Result not found');
    }

    const userId = base.r_userId;
    const isStandard = base.r_quizType === QuizTypeEnum.Standard;
    const quizId = isStandard ? base.r_quizId : base.r_userQuizId;
    const quizIdColumn = isStandard ? 'quizId' : 'userQuizId';

    const attemptSelect = (qb: SelectQueryBuilder<QuestionAttempt>) =>
      qb
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
          'qa.timeTaken AS timeTaken',
          'q.level AS level',
          'q.answer AS answer'
        ])
        .innerJoin('qa.question', 'q')
        .innerJoin('q.subject', 's')
        .leftJoin('q.questionTopics', 'qt')
        .leftJoin('qt.topic', 't');

    // Attempts are scoped by resultId. Older rows without a resultId fall back to
    // userId + quiz scoping.
    let questionRows = await attemptSelect(
      this.dataSource.createQueryBuilder(QuestionAttempt, 'qa'),
    )
      .where('qa.resultId = :resultId', { resultId: base.r_id })
      .getRawMany();

    if (questionRows.length === 0) {
      questionRows = await attemptSelect(
        this.dataSource.createQueryBuilder(QuestionAttempt, 'qa'),
      )
        .where('qa.userId = :userId', { userId })
        .andWhere(`qa.${quizIdColumn} = :quizId`, { quizId })
        .andWhere('qa.resultId IS NULL')
        .getRawMany();
    }

    // The topic join yields one row per (question, topic). Per-question figures —
    // questions, timeSpent, subject stats — must use one row per question.
    const uniqueQuestionRows = new Map<number, any>();
    questionRows.forEach((r) => {
      if (!uniqueQuestionRows.has(r.questionId)) {
        uniqueQuestionRows.set(r.questionId, r);
      }
    });
    const questionList = Array.from(uniqueQuestionRows.values());

    const timeSpent = questionList.reduce((sum, r) => sum + (Number(r.timeTaken) || 0), 0);

    const levelLabelMap: Record<number, string> = {
      [DifficultyLevelEnum.Easy]: 'Easy',
      [DifficultyLevelEnum.Intermediate]: 'Intermediate',
      [DifficultyLevelEnum.Advanced]: 'Advanced',
    };

    const options = questionList.length
      ? await this.dataSource
          .createQueryBuilder(QuestionOption, 'qo')
          .select([
            'qo.id AS id',
            'qo.questionId AS questionId',
            'qo.option AS text',
            'qo.correct AS correct',
          ])
          .where('qo.questionId IN (:...questionIds)', {
            questionIds: questionList.map((r) => r.questionId),
          })
          .getRawMany()
      : [];
    const optionsByQuestion = new Map<number, any[]>();
    for (const o of options) {
      const key = Number(o.questionId);
      if (!optionsByQuestion.has(key)) optionsByQuestion.set(key, []);
      optionsByQuestion.get(key).push(o);
    }

    const questions = questionList.map((r) => {
      const selectedOptionId = r.selectedOptionId != null ? Number(r.selectedOptionId) : null;
      return {
        id: r.questionId,
        text: r.text,
        options: (optionsByQuestion.get(Number(r.questionId)) ?? []).map((o) => ({
          id: Number(o.id),
          text: o.text,
          correct: Boolean(o.correct),
          selected: Number(o.id) === selectedOptionId,
        })),
        selectedOptionId,
        isSkipped: r.isSkipped ?? false,
        isCorrect: r.isCorrect ?? false,
        subjectId: r.subjectId,
        topicId: r.topicId,
        timeTaken: Number(r.timeTaken) || 0,
        answer: r.answer ?? null,
        levelLabel: r.level ? levelLabelMap[Number(r.level)] ?? null : null,
        level: r.level ?? null,
      };
    });

    // Raw rows carry MySQL TINYINT 0/1 for booleans, hence Number(...) comparisons below.
    const subjectsMap = new Map<number, any>();
    questionList.forEach((r) => {
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
      if (Number(r.isSkipped) === 0) sub.answered += 1;
      if (Number(r.isCorrect) === 1) {
        sub.correct += 1;
      } else if (Number(r.isSkipped) === 0 && Number(r.isCorrect) === 0) {
        sub.wrong += 1;
      }
    });

    // Accuracy is correct / asked (skips count), matching the other scoring surfaces.
    const subjects = Array.from(subjectsMap.values()).map((s) => ({
      ...s,
      score: generateScore(s.asked, s.correct, s.wrong),
      coverage: s.asked ? +((s.answered / s.asked) * 100).toFixed(1) : 0,
      accuracy: s.asked ? +((s.correct / s.asked) * 100).toFixed(1) : 0,
    }));

    // Topic stats use every (question, topic) row: a multi-topic question counts once
    // per topic.
    const topicsMap = new Map<number, any>();
    questionRows.forEach((r) => {
      if (!r.topicId) return;
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
      if (Number(r.isSkipped) === 0) t.answered += 1;
      if (Number(r.isCorrect) === 1) {
        t.correct += 1;
      } else if (Number(r.isSkipped) === 0 && Number(r.isCorrect) === 0) {
        t.wrong += 1;
      }
    });

    const topics = Array.from(topicsMap.values()).map((t) => ({
      ...t,
      score: generateScore(t.asked, t.correct, t.wrong),
      coverage: t.asked ? +((t.answered / t.asked) * 100).toFixed(1) : 0,
      accuracy: t.asked ? +((t.correct / t.asked) * 100).toFixed(1) : 0,
    }));

    return {
      resultCode: base.r_resultCode,
      score: Number(base.r_score) || 0,
      accuracy: base.r_total ? +((base.r_correct / base.r_total) * 100).toFixed(1) : 0,
      total: Number(base.r_total) || 0,
      correct: Number(base.r_correct) || 0,
      wrong: Number(base.r_wrong) || 0,
      unanswered: Number(base.r_unanswered) || 0,
      timeSpent,
      remarks: base.r_remarks ?? '',
      feedback: base.r_feedback ?? '',
      createdAt: base.r_createdAt,
      isOwner: viewerId != null && Number(viewerId) === Number(userId),
      user: {
        firstName: base.u_firstName,
        lastName: base.u_lastName,
        username: base.u_username,
        image: base.u_image,
      },
      quiz: {
        id: quizId,
        title: base.title,
        description: base.description,
        slug: base.slug,
        quizType: base.r_quizType,
      },
      subjects,
      topics,
      questions,
    };
  }

  /** The user's result codes per Standard quiz, newest first. */
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
