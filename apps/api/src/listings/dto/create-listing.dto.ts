import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import {
  INSTALLMENT,
  ListingType,
  RentPeriod,
  enumValues,
  type ListingType as ListingTypeValue,
  type RentPeriod as RentPeriodValue,
} from '@genuine-homes/shared';

/**
 * Create a listing. Type-specific rules (which fields each listing type
 * requires/forbids) are enforced in the service via `listingShapeError`.
 */
export class CreateListingDto {
  @ApiProperty({ enum: enumValues(ListingType) })
  @IsIn(enumValues(ListingType))
  listingType!: ListingTypeValue;

  @ApiProperty({ example: 1_500_000, description: 'Rent/sale/total price' })
  @IsNumber()
  @IsPositive()
  @Max(1e12)
  price!: number;

  @ApiPropertyOptional({ example: 'UGX', default: 'UGX' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['UGX', 'KES', 'TZS'])
  currency?: string;

  // Required for rent listings (monthly/yearly).
  @ApiPropertyOptional({ enum: enumValues(RentPeriod) })
  @IsOptional()
  @IsIn(enumValues(RentPeriod))
  rentPeriod?: RentPeriodValue;

  // Required for installment listings.
  @ApiPropertyOptional({
    minimum: INSTALLMENT.MIN_DEPOSIT_PERCENT,
    maximum: INSTALLMENT.MAX_DEPOSIT_PERCENT,
  })
  @IsOptional()
  @IsNumber()
  @Min(INSTALLMENT.MIN_DEPOSIT_PERCENT)
  @Max(INSTALLMENT.MAX_DEPOSIT_PERCENT)
  minDepositPercent?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: INSTALLMENT.MAX_MONTHS })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INSTALLMENT.MAX_MONTHS)
  maxInstallmentMonths?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
