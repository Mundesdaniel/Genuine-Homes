import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

/** Carries the refresh token for the /refresh and /logout endpoints. */
export class RefreshDto {
  @ApiProperty({ description: 'The refresh token issued at login/refresh' })
  @IsJWT()
  refreshToken!: string;
}
