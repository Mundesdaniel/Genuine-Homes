import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BOOKING } from '@genuine-homes/shared';

/** Request a viewing of a listing. Mirrors `createBookingSchema`. */
export class CreateBookingDto {
  @ApiProperty({ description: 'The listing you want to view' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ description: 'Preferred viewing date + time (ISO-8601)' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: 'Is a weekend viewing possible?' })
  @IsOptional()
  @IsString()
  @MaxLength(BOOKING.MESSAGE_MAX)
  message?: string;
}
