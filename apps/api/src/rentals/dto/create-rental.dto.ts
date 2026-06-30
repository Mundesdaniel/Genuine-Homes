import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RENTAL } from '@genuine-homes/shared';

/** Start a rental agreement from a rent listing. Mirrors `createRentalSchema`. */
export class CreateRentalDto {
  @ApiProperty({ description: 'The rent listing to rent' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ description: 'Move-in date (YYYY-MM-DD)' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ minimum: RENTAL.MIN_MONTHS, maximum: RENTAL.MAX_MONTHS })
  @IsOptional()
  @IsInt()
  @Min(RENTAL.MIN_MONTHS)
  @Max(RENTAL.MAX_MONTHS)
  months?: number;
}
