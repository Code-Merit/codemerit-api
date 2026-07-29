import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Interview } from 'src/common/typeorm/entities/interview.entity';
import { AssessmentSession } from 'src/common/typeorm/entities/assessment-session.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { InterviewStatusEnum } from 'src/common/enum/interview-status.enum';
import { AssessmentSessionStatusEnum } from 'src/common/enum/assessment-session-status.enum';

@Injectable()
export class AdminInterviewsService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,

    @InjectRepository(AssessmentSession)
    private readonly assessmentSessionRepo: Repository<AssessmentSession>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getInterviewStats() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 29);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      total,
      byStatusRaw,
      roundsByStatusRaw,
      scheduledThisWeek,
      scheduledThisMonth,
      topInterviewersRaw,
    ] = await Promise.all([
      this.interviewRepo.count(),
      this.interviewRepo
        .createQueryBuilder('i')
        .select(['i.status as status', 'COUNT(i.id) as count'])
        .groupBy('i.status')
        .getRawMany(),
      this.assessmentSessionRepo
        .createQueryBuilder('s')
        .select(['s.status as status', 'COUNT(s.id) as count'])
        .where('s.status IS NOT NULL')
        .groupBy('s.status')
        .getRawMany(),
      this.interviewRepo
        .createQueryBuilder('i')
        .where('i.createdAt >= :startOfWeek', { startOfWeek })
        .getCount(),
      this.interviewRepo
        .createQueryBuilder('i')
        .where('i.createdAt >= :startOfMonth', { startOfMonth })
        .getCount(),
      this.assessmentSessionRepo
        .createQueryBuilder('s')
        .select(['s.interviewerId as interviewerId', 'COUNT(s.id) as roundsCompleted'])
        .where('s.status = :completed', { completed: AssessmentSessionStatusEnum.COMPLETED })
        .andWhere('s.interviewerId IS NOT NULL')
        .groupBy('s.interviewerId')
        .orderBy('roundsCompleted', 'DESC')
        .limit(5)
        .getRawMany(),
    ]);

    const byStatus = { scheduled: 0, inProgress: 0, completed: 0, cancelled: 0 };
    for (const row of byStatusRaw) {
      const count = +row.count || 0;
      if (row.status === InterviewStatusEnum.SCHEDULED) byStatus.scheduled = count;
      else if (row.status === InterviewStatusEnum.IN_PROGRESS) byStatus.inProgress = count;
      else if (row.status === InterviewStatusEnum.COMPLETED) byStatus.completed = count;
      else if (row.status === InterviewStatusEnum.CANCELLED) byStatus.cancelled = count;
    }

    const roundsByStatus = { assigned: 0, started: 0, completed: 0, declined: 0, cancelled: 0 };
    for (const row of roundsByStatusRaw) {
      const count = +row.count || 0;
      if (row.status === AssessmentSessionStatusEnum.ASSIGNED) roundsByStatus.assigned = count;
      else if (row.status === AssessmentSessionStatusEnum.STARTED) roundsByStatus.started = count;
      else if (row.status === AssessmentSessionStatusEnum.COMPLETED) roundsByStatus.completed = count;
      else if (row.status === AssessmentSessionStatusEnum.DECLINED) roundsByStatus.declined = count;
      else if (row.status === AssessmentSessionStatusEnum.CANCELLED) roundsByStatus.cancelled = count;
    }

    const completionRate = total > 0 ? (byStatus.completed / total) * 100 : 0;
    const resolvedRounds = roundsByStatus.completed + roundsByStatus.declined;
    const declineRate = resolvedRounds > 0 ? (roundsByStatus.declined / resolvedRounds) * 100 : 0;

    const topInterviewers = await this.attachInterviewerNames(topInterviewersRaw);

    return {
      total,
      byStatus,
      roundsByStatus,
      scheduledThisWeek,
      scheduledThisMonth,
      completionRate,
      declineRate,
      topInterviewers,
    };
  }

  private async attachInterviewerNames(
    rows: { interviewerId: string | number; roundsCompleted: string | number }[],
  ) {
    if (!rows.length) return [];
    const ids = rows.map((r) => +r.interviewerId);
    const users = await this.userRepo.findBy({ id: In(ids) });
    const userById = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const user = userById.get(+r.interviewerId);
      return {
        id: +r.interviewerId,
        name: user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Unknown',
        roundsCompleted: +r.roundsCompleted,
      };
    });
  }
}
