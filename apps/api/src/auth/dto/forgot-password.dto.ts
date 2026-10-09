import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

/** Password-reset request payload. Mirrors `forgotPasswordSchema` in shared. */
export class ForgotPasswordDto {
  @ApiProperty({
    example: '+256700000003',
    description: 'The email or phone used at registration',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  emailOrPhone!: string;
}
