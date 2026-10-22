import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
} from 'class-validator';
import { SHORT_LET } from '@genuine-homes/shared';

/** Record a nightly stay. Mirrors `createShortLetBookingSchema`. */
export class CreateShortLetBookingDto {
  @ApiProperty({ description: 'The short-let listing this stay is for' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ example: '2026-11-01', description: 'Check-in date (YYYY-MM-DD)' })
  @IsDateString()
  checkIn!: string;

  @ApiProperty({ example: '2026-11-05', description: 'Check-out date (exclusive)' })
  @IsDateString()
  checkOut!: string;

  @ApiProperty({ example: 450_000, description: 'Income for the stay' })
  @IsNumber()
  @IsPositive()
  @Max(1e12)
  amount!: number;

  @ApiPropertyOptional({ default: 'UGX' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_LET.GUEST_MAX)
  guestName?: string;
}
