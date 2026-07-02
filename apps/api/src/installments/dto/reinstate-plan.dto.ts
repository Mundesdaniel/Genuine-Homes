import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReinstatePlanDto {
  @ApiPropertyOptional({ example: 'Payment arrangement agreed on 2026-07-01.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
