import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  IsUrl,
  Matches,
  Max,
} from 'class-validator';
import {
  PaymentProvider,
  PaymentPurpose,
  enumValues,
  type PaymentProvider as PaymentProviderValue,
  type PaymentPurpose as PaymentPurposeValue,
} from '@genuine-homes/shared';

/** Start a payment. Mirrors `initiatePaymentSchema` in shared. */
export class InitiatePaymentDto {
  @ApiProperty({ enum: enumValues(PaymentPurpose) })
  @IsIn(enumValues(PaymentPurpose))
  purpose!: PaymentPurposeValue;

  @ApiPropertyOptional({ description: 'The record this payment settles' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiProperty({ example: 1_500_000 })
  @IsNumber()
  @IsPositive()
  @Max(1e12)
  amount!: number;

  @ApiPropertyOptional({ default: 'UGX' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['UGX', 'KES', 'TZS'])
  currency?: string;

  @ApiProperty({ enum: enumValues(PaymentProvider), description: 'Payment method' })
  @IsIn(enumValues(PaymentProvider))
  provider!: PaymentProviderValue;

  @ApiPropertyOptional({ example: '+256700000000', description: 'Mobile Money number' })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Enter a valid phone number in international format',
  })
  phone?: string;

  @ApiPropertyOptional({ description: 'Return URL after hosted checkout' })
  @IsOptional()
  @IsUrl()
  redirectUrl?: string;
}
