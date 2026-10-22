import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/**
 * Admin approves a request: records the subscription for this date range and
 * grants the airbnb_agent role. Mirrors `approveSubscriptionRequestSchema`.
 */
export class ApproveSubscriptionRequestDto {
  @ApiProperty({ description: 'When the subscription starts (ISO-8601)' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ description: 'When the subscription expires (ISO-8601)' })
  @IsDateString()
  expiresAt!: string;
}
