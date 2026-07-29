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
import { TopicsService } from 'src/modules/topics/providers/topics.service';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { SkillMetric } from 'src/common/typeorm/entities/skill-metric.entity';

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
