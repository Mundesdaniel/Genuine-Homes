import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { REVIEW } from '@genuine-homes/shared';

/** Create or update a review for an agent/landlord. Mirrors `createReviewSchema`. */
export class CreateReviewDto {
  @ApiProperty({ description: 'The user (agent/landlord) being reviewed' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ minimum: REVIEW.MIN_RATING, maximum: REVIEW.MAX_RATING })
  @IsInt()
  @Min(REVIEW.MIN_RATING)
  @Max(REVIEW.MAX_RATING)
  rating!: number;

  @ApiPropertyOptional({ maxLength: REVIEW.MAX_COMMENT })
  @IsOptional()
  @IsString()
  @MaxLength(REVIEW.MAX_COMMENT)
  comment?: string;
}
