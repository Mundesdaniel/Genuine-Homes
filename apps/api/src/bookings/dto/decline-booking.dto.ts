import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BOOKING } from '@genuine-homes/shared';

/** Declining a viewing request may carry a short reason (shown to the buyer). */
export class DeclineBookingDto {
  @ApiPropertyOptional({ example: 'That slot is taken — please pick another time.' })
  @IsOptional()
  @IsString()
  @MaxLength(BOOKING.MESSAGE_MAX)
  reason?: string;
}
