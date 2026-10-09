import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Declining a requested plan may carry a reason (audit-logged for the buyer). */
export class DeclinePlanDto {
  @ApiPropertyOptional({ example: 'Prefer an outright sale for this unit.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
