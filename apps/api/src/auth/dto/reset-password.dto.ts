import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Password-reset completion payload. Mirrors `resetPasswordSchema` in shared. */
export class ResetPasswordDto {
  @ApiProperty({ description: 'The single-use token from the reset link' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain a letter and a number',
  })
  password!: string;
}
