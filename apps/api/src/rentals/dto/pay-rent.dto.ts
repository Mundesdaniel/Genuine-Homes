import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUrl, Matches } from 'class-validator';
import {
  PaymentProvider,
  type PaymentProvider as PaymentProviderValue,
} from '@genuine-homes/shared';

/** Pay a month's rent. Cash-only. Mirrors `payViaSchema`. */
export class PayRentDto {
  // Cash-only: online gateways are disabled, so cash is the only accepted method.
  @ApiProperty({ enum: [PaymentProvider.CASH], description: 'Payment method (cash only)' })
  @IsIn([PaymentProvider.CASH], { message: 'Only cash payments are accepted' })
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
