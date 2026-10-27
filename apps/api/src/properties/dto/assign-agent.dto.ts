import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

/** Assign an agent to a property. Mirrors `assignAgentSchema` in shared. */
export class AssignAgentDto {
  @ApiProperty({
    example: 'james.agent@example.ug',
    description: "The agent's email or phone — no public agent directory.",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  emailOrPhone!: string;
}
