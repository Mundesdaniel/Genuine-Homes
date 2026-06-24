import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

/** Login payload. Mirrors `loginSchema` in shared. */
export class LoginDto {
  @ApiProperty({
    example: '+256700000003',
    description: 'The email or phone used at registration',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  emailOrPhone!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(1)
  password!: string;
}
