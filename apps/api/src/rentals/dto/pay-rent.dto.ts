import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import {
  PaymentProvider,
  enumValues,
  type PaymentProvider as PaymentProviderValue,
} from '@genuine-homes/shared';

/** Choose how to pay a month's rent. Mirrors `payViaSchema`. */
export class PayRentDto {
  @ApiProperty({ enum: enumValues(PaymentProvider) })
  @IsIn(enumValues(PaymentProvider))
  provider!: PaymentProviderValue;

  @ApiPropertyOptional({ example: '+256700000000' })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Enter a valid phone number in international format',
  })
  phone?: string;
}
