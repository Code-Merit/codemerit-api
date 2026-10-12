import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { InviteTypeEnum } from 'src/common/enum/invite-type.enum';
import { InviteChannelEnum } from 'src/common/enum/invite-channel.enum';

export class CreateInviteDto {
  @ApiProperty({ enum: InviteTypeEnum, description: 'What accepting this invite does.' })
  @IsEnum(InviteTypeEnum)
  type: InviteTypeEnum;

  @ApiPropertyOptional({ description: 'Polymorphic target kind, e.g. "Subject" or "Badge". Omit for a GENERIC invite.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetType?: string;

  @ApiPropertyOptional({ description: 'Id into whatever targetType points at. Omit for a GENERIC invite.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetId?: number;

  @ApiPropertyOptional({ description: 'Display label for the target, e.g. the subject/badge name — shown in the invite email and widget.' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  targetLabel?: string;

  @ApiPropertyOptional({
    enum: InviteChannelEnum,
    description:
      'Omit entirely for a recipient-less, shareable "link" invite — InvitesService ' +
      'only requires recipientEmail/recipientPhone when the matching channel is given, ' +
      'and skips sending an email when channel is omitted.',
  })
  @IsOptional()
  @IsEnum(InviteChannelEnum)
  channel?: InviteChannelEnum;

  @ApiPropertyOptional({ description: 'Required when channel is Email.' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  recipientEmail?: string;

  @ApiPropertyOptional({ description: 'Required when channel is Phone.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  recipientPhone?: string;

  @ApiPropertyOptional({ description: 'Optional personal note included in the invite email.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
