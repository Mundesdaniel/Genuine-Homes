import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { VERIFICATION } from '@genuine-homes/shared';

/** Admin decision on a verification submission. Mirrors `reviewVerificationSchema`. */
export class ReviewVerificationDto {
  @ApiProperty({ enum: ['verified', 'rejected'] })
  @IsIn(['verified', 'rejected'])
  decision!: 'verified' | 'rejected';

  @ApiPropertyOptional({ maxLength: VERIFICATION.MAX_NOTES })
  @IsOptional()
  @IsString()
  @MaxLength(VERIFICATION.MAX_NOTES)
  notes?: string;
}
