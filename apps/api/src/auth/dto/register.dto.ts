import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SELF_ASSIGNABLE_ROLES, type SelfAssignableRole } from '@genuine-homes/shared';

// Trim incoming strings; mirrors the `.trim()` in the shared Zod schemas.
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Self-registration payload. Validation mirrors `registerSchema` in shared. */
export class RegisterDto {
  @ApiProperty({ example: 'David Okello' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @ApiProperty({ example: '+256700000003', description: 'International format' })
  @Transform(trim)
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Enter a valid phone number in international format',
  })
  phone!: string;

  // Optional — many Ugandan users sign up with a phone only.
  @ApiPropertyOptional({ example: 'david@example.ug' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain a letter and a number',
  })
  password!: string;

  // `admin` is intentionally not accepted here — it can only be granted later.
  @ApiPropertyOptional({ enum: SELF_ASSIGNABLE_ROLES, default: 'user' })
  @IsOptional()
  @IsIn([...SELF_ASSIGNABLE_ROLES])
  role?: SelfAssignableRole;
}
