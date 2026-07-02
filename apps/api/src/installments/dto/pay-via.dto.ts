import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUrl, Matches } from 'class-validator';
import {
  PaymentProvider,
  enumValues,
  type PaymentProvider as PaymentProviderValue,
} from '@genuine-homes/shared';

/** Choose how to pay a deposit or installment. Mirrors `payViaSchema`. */
export class PayViaDto {
  @ApiProperty({ enum: enumValues(PaymentProvider) })
  @IsIn(enumValues(PaymentProvider))
  provider!: PaymentProviderValue;

  @ApiPropertyOptional({ example: '+256700000000' })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Enter a valid phone number in international format',
  })
  phone?: string;

  /** Where the hosted checkout returns the payer (the web /payments/return page). */
  @ApiPropertyOptional({ example: 'https://app.genuinehomes.ug/payments/return' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUrl?: string;
}
