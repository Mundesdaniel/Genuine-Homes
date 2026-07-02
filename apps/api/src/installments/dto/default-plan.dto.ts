import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Marking a plan defaulted requires a reason — it is audit-logged and shown to the buyer. */
export class DefaultPlanDto {
  @ApiProperty({
    example: '4 installments missed; no response to 3 contact attempts since April.',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
