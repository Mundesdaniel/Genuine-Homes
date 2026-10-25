import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsUUID, Length } from 'class-validator';
import { SUBSCRIPTION } from '@genuine-homes/shared';

/**
 * Admin records a cash subscription payment and activates it for a date range.
 * Mirrors `recordSubscriptionPaymentSchema`. The expiry-after-start rule is
 * enforced in the service.
 */
export class RecordSubscriptionPaymentDto {
  @ApiProperty({ description: 'The account the subscription is for' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: 'airbnb_monthly' })
  @IsString()
  @Length(1, SUBSCRIPTION.PLAN_MAX)
  plan!: string;

  @ApiProperty({ description: 'When the subscription starts (ISO-8601)' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ description: 'When the subscription expires (ISO-8601)' })
  @IsDateString()
  expiresAt!: string;
}
