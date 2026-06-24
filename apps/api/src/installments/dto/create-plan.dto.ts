import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { INSTALLMENT } from '@genuine-homes/shared';

/** Create an installment plan from a listing. Mirrors `createPlanSchema`. */
export class CreatePlanDto {
  @ApiProperty({ description: 'The installment listing to buy' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({
    minimum: INSTALLMENT.MIN_DEPOSIT_PERCENT,
    maximum: INSTALLMENT.MAX_DEPOSIT_PERCENT,
  })
  @IsNumber()
  @Min(INSTALLMENT.MIN_DEPOSIT_PERCENT)
  @Max(INSTALLMENT.MAX_DEPOSIT_PERCENT)
  depositPercent!: number;

  @ApiProperty({ minimum: 1, maximum: INSTALLMENT.MAX_MONTHS })
  @IsInt()
  @Min(1)
  @Max(INSTALLMENT.MAX_MONTHS)
  months!: number;
}
