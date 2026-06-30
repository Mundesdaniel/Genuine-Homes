import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** `?withUserId=&page=&pageSize=` for fetching a conversation thread. */
export class ThreadQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: 'The other participant' })
  @IsUUID()
  withUserId!: string;
}
