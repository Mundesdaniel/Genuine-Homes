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
} from 'class-validator';
import { STAFF_ASSIGNABLE_ROLES, type StaffAssignableRole } from '@genuine-homes/shared';

// Trim incoming strings; mirrors the `.trim()` in the shared Zod schemas.
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Admin-only: create a staff account directly. Mirrors `createStaffUserSchema`.
 * The role is restricted to the elevated staff roles — `user` and `admin` are
 * deliberately not creatable here.
 */
export class CreateStaffUserDto {
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

  @ApiPropertyOptional({ example: 'agent@example.ug' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ enum: STAFF_ASSIGNABLE_ROLES })
  @IsIn([...STAFF_ASSIGNABLE_ROLES])
  role!: StaffAssignableRole;
}
