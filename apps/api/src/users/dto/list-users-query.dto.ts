import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  UserRole,
  enumValues,
  type UserRole as UserRoleValue,
} from '@genuine-homes/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** `?page=&pageSize=&role=` for the admin user list. */
export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: enumValues(UserRole) })
  @IsOptional()
  @IsIn(enumValues(UserRole))
  role?: UserRoleValue;
}
