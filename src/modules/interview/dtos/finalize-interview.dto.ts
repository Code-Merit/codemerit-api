import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class FinalizeInterviewDto {
  @ApiPropertyOptional({
    example: 'Strong across both rounds — recommend moving forward.',
    description: "Manager's overall summary across all rounds, separate from each round's own SME feedback.",
  })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  feedback?: string;
}
