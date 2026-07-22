import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackJobRole } from 'src/common/typeorm/entities/certification-track-job-role.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { SubjectTrackTopic } from 'src/common/typeorm/entities/subject-track-topic.entity';
import { Repository } from 'typeorm';
import { CertificationTrackResponseDto } from '../dtos/certification-track-response.dto';
import { CreateCertificationTrackDto } from '../dtos/create-certification-track.dto';
import { LinkJobRoleDto } from '../dtos/link-job-role.dto';
import { LinkSubjectTracksDto } from '../dtos/link-subject-tracks.dto';
import { UpdateCertificationTrackDto } from '../dtos/update-certification-track.dto';
import { UpdateJobRoleLinkDto } from '../dtos/update-job-role-link.dto';

@Injectable()
export class CertificationTrackService {
  constructor(
    @InjectRepository(CertificationTrack)
    private trackRepo: Repository<CertificationTrack>,
    @InjectRepository(CertificationTrackJobRole)
    private ctJobRoleRepo: Repository<CertificationTrackJobRole>,
    @InjectRepository(CertificationTrackSubjectTrack)
    private ctStRepo: Repository<CertificationTrackSubjectTrack>,
    @InjectRepository(SubjectTrackTopic)
    private sttRepo: Repository<SubjectTrackTopic>,
    @InjectRepository(JobRole)
    private jobRoleRepo: Repository<JobRole>,
  ) {}

  async create(dto: CreateCertificationTrackDto): Promise<CertificationTrackResponseDto> {
    const track = await this.trackRepo.save(this.trackRepo.create(dto));
    return this.toResponseDto(track.id);
  }

  async findAll(): Promise<CertificationTrackResponseDto[]> {
    const tracks = await this.trackRepo.find({ order: { title: 'ASC' } });
    return Promise.all(tracks.map((t) => this.toResponseDto(t.id)));
  }

  async findByJobRoleId(jobRoleId: number): Promise<CertificationTrackResponseDto[]> {
    const links = await this.ctJobRoleRepo.find({
      where: { jobRoleId },
      order: { sortOrder: 'ASC' },
    });
    return Promise.all(links.map((link) => this.toResponseDto(link.certificationTrackId)));
  }

  async findOne(id: number): Promise<CertificationTrackResponseDto> {
    await this.assertExists(id);
    return this.toResponseDto(id);
  }

  async update(id: number, dto: UpdateCertificationTrackDto): Promise<CertificationTrackResponseDto> {
    await this.assertExists(id);
    await this.trackRepo.update(id, dto);
    return this.toResponseDto(id);
  }

  async remove(id: number): Promise<void> {
    await this.assertExists(id);
    await this.trackRepo.delete(id);
  }

  async linkSubjectTracks(id: number, dto: LinkSubjectTracksDto): Promise<CertificationTrackResponseDto> {
    await this.assertExists(id);
    for (const subjectTrackId of dto.subjectTrackIds) {
      const exists = await this.ctStRepo.findOne({
        where: { certificationTrackId: id, subjectTrackId },
      });
      if (!exists) {
        await this.ctStRepo.save(
          this.ctStRepo.create({ certificationTrackId: id, subjectTrackId }),
        );
      }
    }
    return this.toResponseDto(id);
  }

  async unlinkSubjectTrack(id: number, subjectTrackId: number): Promise<void> {
    await this.assertExists(id);
    await this.ctStRepo.delete({ certificationTrackId: id, subjectTrackId });
  }

  async linkJobRole(id: number, dto: LinkJobRoleDto): Promise<CertificationTrackResponseDto> {
    await this.assertExists(id);
    const jobRole = await this.jobRoleRepo.findOne({ where: { id: dto.jobRoleId } });
    if (!jobRole) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `JobRole ID ${dto.jobRoleId} not found`);
    }

    const existing = await this.ctJobRoleRepo.findOne({
      where: { certificationTrackId: id, jobRoleId: dto.jobRoleId },
    });
    if (existing) {
      await this.ctJobRoleRepo.update(existing.id, {
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        isPublished: dto.isPublished ?? existing.isPublished,
        descriptionOverride: dto.descriptionOverride ?? existing.descriptionOverride,
      });
    } else {
      await this.ctJobRoleRepo.save(
        this.ctJobRoleRepo.create({
          certificationTrackId: id,
          jobRoleId: dto.jobRoleId,
          sortOrder: dto.sortOrder ?? 1,
          isPublished: dto.isPublished ?? true,
          descriptionOverride: dto.descriptionOverride ?? null,
        }),
      );
    }
    return this.toResponseDto(id);
  }

  async updateJobRoleLink(
    id: number,
    jobRoleId: number,
    dto: UpdateJobRoleLinkDto,
  ): Promise<CertificationTrackResponseDto> {
    const link = await this.assertJobRoleLinkExists(id, jobRoleId);
    await this.ctJobRoleRepo.update(link.id, dto);
    return this.toResponseDto(id);
  }

  async unlinkJobRole(id: number, jobRoleId: number): Promise<void> {
    await this.assertJobRoleLinkExists(id, jobRoleId);
    await this.ctJobRoleRepo.delete({ certificationTrackId: id, jobRoleId });
  }

  private async assertExists(id: number): Promise<CertificationTrack> {
    const track = await this.trackRepo.findOne({ where: { id } });
    if (!track) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `CertificationTrack ID ${id} not found`);
    }
    return track;
  }

  private async assertJobRoleLinkExists(
    certificationTrackId: number,
    jobRoleId: number,
  ): Promise<CertificationTrackJobRole> {
    const link = await this.ctJobRoleRepo.findOne({ where: { certificationTrackId, jobRoleId } });
    if (!link) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `CertificationTrack ID ${certificationTrackId} is not associated with JobRole ID ${jobRoleId}`,
      );
    }
    return link;
  }

  private async toResponseDto(id: number): Promise<CertificationTrackResponseDto> {
    const track = await this.trackRepo.findOne({ where: { id } });

    const jobRoleLinks = await this.ctJobRoleRepo.find({
      where: { certificationTrackId: id },
      relations: ['jobRole'],
      order: { sortOrder: 'ASC' },
    });
    const jobRoles = jobRoleLinks.map((link) => ({
      jobRoleId: link.jobRoleId,
      jobRoleTitle: link.jobRole?.title ?? '',
      sortOrder: link.sortOrder,
      isPublished: link.isPublished,
      descriptionOverride: link.descriptionOverride,
    }));

    const links = await this.ctStRepo.find({
      where: { certificationTrackId: id },
      relations: ['subjectTrack', 'subjectTrack.subject'],
    });

    const subjectTracks = await Promise.all(
      links.map(async (link) => {
        const st = link.subjectTrack;
        const topicCount = await this.sttRepo.count({
          where: { subjectTrackId: st.id },
        });
        return {
          id: st.id,
          title: st.title,
          slug: st.slug,
          subjectId: st.subjectId,
          subjectName: st.subject?.title ?? '',
          topicCount,
        };
      }),
    );

    return {
      id: track.id,
      title: track.title,
      description: track.description,
      jobRoles,
      subjectTrackCount: subjectTracks.length,
      subjectTracks,
    };
  }
}
