import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import {
  UserRole,
  enumValues,
  type UserRole as UserRoleValue,
} from '@genuine-homes/shared';

/** Admin-only user changes. Mirrors `adminUpdateUserSchema`. */
export class AdminUpdateUserDto {
  @ApiPropertyOptional({ enum: enumValues(UserRole) })
  @IsOptional()
  @IsIn(enumValues(UserRole))
  role?: UserRoleValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
