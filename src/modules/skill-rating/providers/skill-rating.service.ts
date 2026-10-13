import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { SkillRating } from 'src/common/typeorm/entities/skill-rating.entity';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { AssessmentSession } from 'src/common/typeorm/entities/assessment-session.entity';
import { validate } from 'class-validator';
import { CreateAssessmentSessionDto } from '../dtos/create-assessment-session.dto';
import { AssessmentSessionResponseDto } from '../dtos/assessment-session-response';
import { SkillTypeEnum } from 'src/common/enum/skill-type.enum';
import { RatingTypeEnum } from 'src/common/enum/rating-type.enum';
import { TopicsService } from 'src/modules/topics/providers/topics.service';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { SkillMetric } from 'src/common/typeorm/entities/skill-metric.entity';
import {
  SelfRatedMetricDto,
  SelfRatedSubjectDto,
} from '../dtos/self-rated-overview.dto';

@Injectable()
export class SkillRatingService {
  constructor(
    @InjectRepository(AssessmentSession)
    private readonly sessionRepo: Repository<AssessmentSession>,

    @InjectRepository(SkillRating)
    private readonly skillRepo: Repository<SkillRating>,

    private readonly topicService: TopicsService,

    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,

    @InjectRepository(SkillMetric)
    private readonly skillMetricRepo: Repository<SkillMetric>,

    private readonly dataSource: DataSource,
  ) {}

  // Lookup list for building a rating form when skillType === 'SkillMetric' —
  // skillId in a SkillRating of that type refers to one of these rows.
  async findActiveSkillMetrics(): Promise<SkillMetric[]> {
    return this.skillMetricRepo.find({
      where: { isActive: true },
      order: { category: 'ASC', title: 'ASC' },
    });
  }

  async create(dto: CreateAssessmentSessionDto): Promise<AssessmentSession> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    console.log("CreateSkillRating", dto);
    try {

      // Create and validate AssessmentSession (use new for class-validator)
      const session = Object.assign(new AssessmentSession(), {
        userId: dto.userId,
        candidateId: dto.userId,
        interviewerId: dto.ratedBy || null,
        assessmentTitle: dto.assessmentTitle,
        notes: dto.notes,
        ratedBy: dto.ratedBy,
        ratingType: dto.ratingType
      });

      // DTO validation is handled by NestJS pipes; no need to validate entity here.

      const savedSession = await queryRunner.manager.save(session);

      // Create and validate SkillRatings
      const skillRatings: SkillRating[] = [];
      console.log("CreateSkillRating skillRatings", dto.skillRatings);
      for (const ratingDto of dto.skillRatings) {
        const skillRating = this.skillRepo.create({
          skillId: ratingDto.skillId,
          skillType: ratingDto.skillType,
          rating: ratingDto.rating,
          ratingType: ratingDto.ratingType,
          assessmentSessionId: savedSession.id
        });

        // const errors = await validate(skillRating);
        // if (errors.length) {
        //   throw new AppCustomException(
        //     HttpStatus.BAD_REQUEST,
        //     `Skill Rating validation failed`,
        //   );
        // }

        skillRatings.push(skillRating);
      }

      await queryRunner.manager.save(skillRatings);

      await queryRunner.commitTransaction();

      return this.findOne(savedSession.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(err.message);
    } finally {
      await queryRunner.release();
    }
  }

  //   async findAll(): Promise<AssessmentSessionResponseDto[]> {
  //   const sessions = await this.sessionRepo.find({
  //     relations: ['user', 'skillRatings'],
  //     // order: { audit.createdAt:'DESC' },
  //   });

  //   return sessions.map(this.mapToResponseDto);
  // }

  async findOne(id: number): Promise<AssessmentSession> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['user', 'skillRatings'],
    });

    if (!session) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `Assessment ID ${id} not found`,
      );
    }
    return session;
  }

  async findAssessmentSession(
    id: number,
  ): Promise<AssessmentSessionResponseDto> {
    const session = await this.findOne(id);
    // if (!session) {
    //   throw new AppCustomException(
    //       HttpStatus.BAD_REQUEST,
    //       `Assessment Session ID ${id} not found`,
    //     );
    // }

    // Get all unique skill IDs by type
    if (session) {
      const subjectIds = session.skillRatings
        .filter((r) => r.skillType === SkillTypeEnum.SUBJECT)
        .map((r) => r.skillId);

      const topicIds = session.skillRatings
        .filter((r) => r.skillType === SkillTypeEnum.TOPIC)
        .map((r) => r.skillId);

      const subjects = await this.subjectRepo.find({
        where: { id: In(subjectIds) },
      });
      const topics = await this.topicService.findByIds(topicIds);

      const subjectMap = new Map(subjects.map((s) => [s.id, s.title]));
      const topicMap = new Map(topics.map((t) => [t.id, t.title]));

      return {
        ...this.mapToResponseDto(session, subjectMap, topicMap),
      };
    }
  }

  async remove(id: number): Promise<void> {
    const session = await this.findOne(id);
    await this.sessionRepo.remove(session);
  }

  private mapToResponseDto(
    session: AssessmentSession,
    subjectMap: Map<number, string>,
    topicMap: Map<number, string>,
  ): AssessmentSessionResponseDto {
    return {
      id: session.id,
      userId: session.user?.id,
      userName: `${session.user?.firstName} ${session.user?.lastName}`,
      assessmentTitle: session.assessmentTitle || 'Assessment',
      notes: session.notes,
      ratedById: session.ratedBy,
      ratedByName:
        `${session.rater?.firstName} ${session.rater?.lastName}` || '',
      ratingType: session.ratingType,
      createdAt: session.createdAt,
      skillRatings: session.skillRatings.map((rating) => {
        let skillName = '';

        if (rating.skillType === SkillTypeEnum.SUBJECT) {
          skillName = subjectMap.get(rating.skillId) || '';
        } else if (rating.skillType === SkillTypeEnum.TOPIC) {
          skillName = topicMap.get(rating.skillId) || '';
        }

        return {
          id: rating.id,
          skillId: rating.skillId,
          skillType: rating.skillType,
          skillName,
          rating: rating.rating,
        };
      }),
    };
  }

  // One row per skillId, holding only that skill's most-recent SELF rating — the dedupe-to-
  // latest-per-skill pattern, generalized so it works for SKILL_METRIC, TOPIC, and SUBJECT alike
  // instead of being written inline once per scope. Every SELF submission is an unconditional
  // insert (see create() above — no unique constraint, full history by design), so "current
  // rating" is always "most recent row", never an update.
  private async getLatestSelfRatings(
    userId: number,
    skillType: SkillTypeEnum,
    skillIds?: number[],
  ): Promise<Map<number, { rating: number; ratedAt: Date }>> {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('sr.skillId', 'skillId')
      .addSelect('sr.rating', 'rating')
      .addSelect('ases.createdAt', 'ratedAt')
      .from(SkillRating, 'sr')
      .innerJoin(AssessmentSession, 'ases', 'ases.id = sr.assessmentSessionId')
      .where('ases.userId = :userId', { userId })
      .andWhere('ases.ratingType = :ratingType', { ratingType: RatingTypeEnum.SELF })
      .andWhere('sr.skillType = :skillType', { skillType })
      .orderBy('ases.createdAt', 'DESC');
    if (skillIds?.length) {
      qb.andWhere('sr.skillId IN (:...skillIds)', { skillIds });
    }
    const rows = await qb.getRawMany();
    const latest = new Map<number, { rating: number; ratedAt: Date }>();
    for (const row of rows) {
      const skillId = +row.skillId;
      if (!latest.has(skillId)) {
        latest.set(skillId, { rating: +row.rating, ratedAt: row.ratedAt });
      }
    }
    return latest;
  }

  // Full SkillMetric catalog, each joined with the caller's own latest self-rating (if any) —
  // backs the "Extra Skill Areas" widget, which needs to show and let the user re-rate every
  // metric (rated or not) without a second call to GET skill-metrics.
  async getSelfRatedMetrics(userId: number): Promise<SelfRatedMetricDto[]> {
    const [metrics, latest] = await Promise.all([
      this.findActiveSkillMetrics(),
      this.getLatestSelfRatings(userId, SkillTypeEnum.SKILL_METRIC),
    ]);
    return metrics.map((m) => {
      const hit = latest.get(m.id);
      return {
        id: m.id,
        title: m.title,
        description: m.description ?? null,
        category: m.category ?? null,
        maxScore: m.maxScore,
        currentRating: hit?.rating ?? null,
        ratedAt: hit?.ratedAt ?? null,
      };
    });
  }

  // Per-subject self-rating rollup for the "By Subject" widget. Two pools can back a subject's
  // number — per-topic ratings from the Subject Dashboard wizard (TOPIC), or a single direct
  // rating from the job-role wizard (SUBJECT) — reconciled here so the frontend never has to know
  // both exist: prefer TOPIC whenever any topic has been rated (finer-grained signal), fall back
  // to the direct SUBJECT rating, otherwise `source: 'none'`. `subjects` is passed in by the
  // caller (already fetched for courseStats) rather than re-queried here.
  async getSelfRatedSubjects(
    userId: number,
    subjects: { id: number; title: string; slug: string; image?: string | null }[],
  ): Promise<SelfRatedSubjectDto[]> {
    if (!subjects.length) return [];
    const subjectIds = subjects.map((s) => s.id);

    const topicRows = await this.dataSource
      .createQueryBuilder()
      .select('t.id', 'id')
      .addSelect('t.subjectId', 'subjectId')
      .from('topic', 't')
      .where('t.subjectId IN (:...subjectIds)', { subjectIds })
      .andWhere('t.isPublished = 1')
      .getRawMany();

    const topicIdsBySubject = new Map<number, number[]>();
    for (const row of topicRows) {
      const sId = +row.subjectId;
      const list = topicIdsBySubject.get(sId) ?? [];
      list.push(+row.id);
      topicIdsBySubject.set(sId, list);
    }
    const allTopicIds = topicRows.map((r) => +r.id);

    const [topicRatings, subjectRatings] = await Promise.all([
      this.getLatestSelfRatings(userId, SkillTypeEnum.TOPIC, allTopicIds),
      this.getLatestSelfRatings(userId, SkillTypeEnum.SUBJECT, subjectIds),
    ]);

    return subjects.map((s) => {
      const topicIds = topicIdsBySubject.get(s.id) ?? [];
      const ratedTopicEntries = topicIds
        .map((tid) => topicRatings.get(tid))
        .filter((v): v is { rating: number; ratedAt: Date } => !!v);

      if (ratedTopicEntries.length > 0) {
        const avg = ratedTopicEntries.reduce((sum, r) => sum + r.rating, 0) / ratedTopicEntries.length;
        const lastRatedAt = ratedTopicEntries.reduce(
          (max, r) => (r.ratedAt > max ? r.ratedAt : max),
          ratedTopicEntries[0].ratedAt,
        );
        return {
          subjectId: s.id,
          title: s.title,
          slug: s.slug,
          image: s.image ?? null,
          totalTopics: topicIds.length,
          ratedTopics: ratedTopicEntries.length,
          averageRating: Math.round(avg * 10) / 10,
          lastRatedAt,
          source: 'topic' as const,
        };
      }

      const subjectHit = subjectRatings.get(s.id);
      if (subjectHit) {
        return {
          subjectId: s.id,
          title: s.title,
          slug: s.slug,
          image: s.image ?? null,
          totalTopics: topicIds.length,
          ratedTopics: 0,
          averageRating: subjectHit.rating,
          lastRatedAt: subjectHit.ratedAt,
          source: 'subject' as const,
        };
      }

      return {
        subjectId: s.id,
        title: s.title,
        slug: s.slug,
        image: s.image ?? null,
        totalTopics: topicIds.length,
        ratedTopics: 0,
        averageRating: null,
        lastRatedAt: null,
        source: 'none' as const,
      };
    });
  }

  async findByUserId(userId: number): Promise<AssessmentSessionResponseDto[]> {
    const sessions = await this.sessionRepo.find({
      where: { userId },
      relations: ['user', 'skillRatings'],
      // order: { createdAt: 'DESC' },
    });
    console.log('sessions', sessions);

    if (!sessions || sessions.length == 0) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `User ID ${userId} not found`,
      );
    }
    // Collect skillIds by type for batch lookups
    const subjectIds = sessions.flatMap((s) =>
      s.skillRatings
        .filter((r) => r.skillType === SkillTypeEnum.SUBJECT)
        .map((r) => r.skillId),
    );
    const topicIds = sessions.flatMap((s) =>
      s.skillRatings
        .filter((r) => r.skillType === SkillTypeEnum.TOPIC)
        .map((r) => r.skillId),
    );

    const subjects = await this.subjectRepo.find({
      where: { id: In(subjectIds) },
    });
    const topics = await this.topicService.findByIds(topicIds);

    const subjectMap = new Map(subjects.map((s) => [s.id, s.title]));
    const topicMap = new Map(topics.map((t) => [t.id, t.title]));

    return sessions.map((session) =>
      this.mapToResponseDto(session, subjectMap, topicMap),
    );
  }
}
