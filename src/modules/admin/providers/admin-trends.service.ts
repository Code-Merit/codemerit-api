import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/common/typeorm/entities/user.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { Quiz } from 'src/common/typeorm/entities/quiz.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { UserBadge } from 'src/common/typeorm/entities/user-badge.entity';
import { Interview } from 'src/common/typeorm/entities/interview.entity';

// ------------------- TIME SERIES (DAILY + WEEKLY) -------------------
// Same MySQL YEAR()/WEEK() bucketing approach used across the admin dashboard.
// For Postgres, replace YEAR/WEEK with EXTRACT(YEAR FROM ...) / EXTRACT(WEEK FROM ...).
@Injectable()
export class AdminTrendsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,

    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,

    @InjectRepository(QuestionAttempt)
    private readonly attemptRepo: Repository<QuestionAttempt>,

    @InjectRepository(Certificate)
    private readonly certificateRepo: Repository<Certificate>,

    @InjectRepository(UserBadge)
    private readonly userBadgeRepo: Repository<UserBadge>,

    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
  ) {}

  async getTrends() {
    const dailyLimit = 30;
    const weeklyLimit = 8;

    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(now);
    startDate.setDate(now.getDate() - (dailyLimit - 1));
    startDate.setHours(0, 0, 0, 0);

    const startWeekDate = new Date(now);
    startWeekDate.setDate(now.getDate() - 7 * (weeklyLimit - 1));
    startWeekDate.setHours(0, 0, 0, 0);

    const series: { repo: Repository<any>; alias: string; key: string; dateColumn: string }[] = [
      { repo: this.userRepo, alias: 'u', key: 'users', dateColumn: 'createdAt' },
      { repo: this.questionRepo, alias: 'q', key: 'questions', dateColumn: 'createdAt' },
      { repo: this.quizRepo, alias: 'qz', key: 'quizzes', dateColumn: 'createdAt' },
      { repo: this.attemptRepo, alias: 'a', key: 'attempts', dateColumn: 'createdAt' },
      { repo: this.certificateRepo, alias: 'c', key: 'certificates', dateColumn: 'issuedAt' },
      { repo: this.userBadgeRepo, alias: 'ub', key: 'badges', dateColumn: 'earnedAt' },
      { repo: this.interviewRepo, alias: 'iv', key: 'interviews', dateColumn: 'createdAt' },
    ];

    const [dailyResults, weeklyResults] = await Promise.all([
      Promise.all(
        series.map((s) =>
          this.dailySeries(s.repo, s.alias, s.dateColumn, startDate, endDate).then((rows) => [
            s.key,
            this.normalizeDaily(rows),
          ]),
        ),
      ),
      Promise.all(
        series.map((s) =>
          this.weeklySeries(s.repo, s.alias, s.dateColumn, startWeekDate, weeklyLimit).then((rows) => [
            s.key,
            this.normalizeWeekly(rows),
          ]),
        ),
      ),
    ]);

    return {
      daily: Object.fromEntries(dailyResults),
      weekly: Object.fromEntries(weeklyResults),
    };
  }

  private dailySeries(
    repo: Repository<any>,
    alias: string,
    dateColumn: string,
    startDate: Date,
    endDate: Date,
  ) {
    return repo
      .createQueryBuilder(alias)
      .select([`DATE(${alias}.${dateColumn}) as date`, `COUNT(${alias}.id) as count`])
      .where(`${alias}.${dateColumn} BETWEEN :startDate AND :endDate`, { startDate, endDate })
      .groupBy(`DATE(${alias}.${dateColumn})`)
      .orderBy(`DATE(${alias}.${dateColumn})`, 'ASC')
      .getRawMany();
  }

  private weeklySeries(
    repo: Repository<any>,
    alias: string,
    dateColumn: string,
    startWeekDate: Date,
    weeklyLimit: number,
  ) {
    return repo
      .createQueryBuilder(alias)
      .select([
        `YEAR(${alias}.${dateColumn}) as year`,
        `WEEK(${alias}.${dateColumn}, 1) as week`,
        `COUNT(${alias}.id) as count`,
      ])
      .where(`${alias}.${dateColumn} >= :startWeekDate`, { startWeekDate })
      .groupBy(`YEAR(${alias}.${dateColumn})`)
      .addGroupBy(`WEEK(${alias}.${dateColumn}, 1)`)
      .orderBy(`YEAR(${alias}.${dateColumn})`, 'DESC')
      .addOrderBy(`WEEK(${alias}.${dateColumn}, 1)`, 'DESC')
      .limit(weeklyLimit)
      .getRawMany();
  }

  private normalizeDaily(rows: any[]) {
    return rows.map((r) => ({ date: r.date, count: +r.count }));
  }

  private normalizeWeekly(rows: any[]) {
    return rows
      .slice()
      .reverse()
      .map((r) => ({
        week: `${r.year}-W${String(r.week).padStart(2, '0')}`,
        count: +r.count,
      }));
  }
}
