import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CHAT } from '@genuine-homes/shared';

/** Send a chat message. Mirrors `sendMessageSchema`. */
export class SendMessageDto {
  @ApiProperty()
  @IsUUID()
  receiverId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @ApiProperty({ maxLength: CHAT.MAX_BODY })
  @IsString()
  @Length(1, CHAT.MAX_BODY)
  body!: string;
}
