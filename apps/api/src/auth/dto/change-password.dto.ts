import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Authenticated password change. Mirrors `changePasswordSchema` in shared. */
export class ChangePasswordDto {
  @ApiProperty({ description: 'The account’s current password' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain a letter and a number',
  })
  newPassword!: string;
}
