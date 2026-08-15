import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserOtp } from 'src/common/typeorm/entities/user-otp.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { UserOtpTagsEnum } from '../enums/user-otp-Tags.enum';

@Injectable()
export class UserOtpService {
  constructor(
    @InjectRepository(UserOtp)
    private userOtpRepo: Repository<UserOtp>
  ) {}

  async create(data: Partial<UserOtp>): Promise<UserOtp | null> {
    const userOtp = this.userOtpRepo.create(data);
    return this.userOtpRepo.save(userOtp);
  }

  async findOne(id: number): Promise<UserOtp | undefined> {
    return this.userOtpRepo.findOne({ where: { id } });
  }

  async findByUserIdTags(
    userId: number,
    tag: UserOtpTagsEnum,
  ): Promise<UserOtp[] | undefined> {
    return this.userOtpRepo.find({
      where: {
        userId: userId,
        tag: tag,
        isUsed: false,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  async countSentSince(
    userId: number,
    tag: UserOtpTagsEnum,
    since: Date,
  ): Promise<number> {
    return this.userOtpRepo.count({
      where: {
        userId: userId,
        tag: tag,
        audit: { createdAt: MoreThanOrEqual(since) },
      },
    });
  }

  async updateIsUsed(id: number): Promise<boolean> {
    const result = await this.userOtpRepo.update({ id: id }, { isUsed: true });
    if (result.affected && result.affected > 0) {
      return true;
    } else {
      return false;
    }
  }
}
