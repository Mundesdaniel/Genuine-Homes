import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { SUBSCRIPTION } from '@genuine-homes/shared';

/** A user asks to subscribe as an AirBnB agent. Mirrors `createSubscriptionRequestSchema`. */
export class CreateSubscriptionRequestDto {
  @ApiProperty({ example: 'airbnb_monthly' })
  @IsString()
  @Length(1, SUBSCRIPTION.PLAN_MAX)
  plan!: string;

  @ApiPropertyOptional({ example: 'I manage 3 short-let apartments in Kampala.' })
  @IsOptional()
  @IsString()
  @MaxLength(SUBSCRIPTION.MESSAGE_MAX)
  message?: string;
}
