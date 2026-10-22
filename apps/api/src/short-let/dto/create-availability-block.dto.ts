import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SHORT_LET } from '@genuine-homes/shared';

/** Block a date range as unavailable. Mirrors `createAvailabilityBlockSchema`. */
export class CreateAvailabilityBlockDto {
  @ApiProperty({ description: 'The short-let listing to block dates for' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ example: '2026-11-10', description: 'First blocked day (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-11-12', description: 'Last blocked day (inclusive)' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ example: 'Maintenance' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_LET.NOTE_MAX)
  note?: string;
}
