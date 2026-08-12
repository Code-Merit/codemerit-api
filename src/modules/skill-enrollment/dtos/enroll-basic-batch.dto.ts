import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsInt, IsOptional, Min } from 'class-validator';

export class EnrollBasicBatchDto {
  @ApiProperty({
    example: [3, 5, 24],
    description:
      'One or more subjects to enroll in at the free Basic tier, in one action. ' +
      'Send every subject in a job role\'s curriculum to enroll in "all of it," or a ' +
      'hand-picked subset — this is the same endpoint either way.',
  })
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  subjectIds: number[];

  @ApiPropertyOptional({
    example: 2,
    description:
      'Which job role this selection was made from, if any — opaque provenance for ' +
      'display/history only. Not validated against the role\'s actual subject list, ' +
      'and never used to gate access.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  jobRoleId?: number;
}
