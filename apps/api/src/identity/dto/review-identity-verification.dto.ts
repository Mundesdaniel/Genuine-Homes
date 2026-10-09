import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { IDENTITY } from '@genuine-homes/shared';

/** Admin decision on an identity submission. Mirrors `reviewIdentityVerificationSchema`. */
export class ReviewIdentityVerificationDto {
  @ApiProperty({ enum: ['verified', 'rejected'] })
  @IsIn(['verified', 'rejected'])
  decision!: 'verified' | 'rejected';

  @ApiPropertyOptional({ maxLength: IDENTITY.MAX_NOTES })
  @IsOptional()
  @IsString()
  @MaxLength(IDENTITY.MAX_NOTES)
  notes?: string;
}
