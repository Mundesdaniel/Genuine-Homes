import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsOptional } from 'class-validator';

/**
 * Body for /refresh and /logout. Browsers don't send a body token — theirs
 * travels in the httpOnly `gh_refresh` cookie, which the controller prefers.
 * The optional field serves non-browser clients (mobile app, scripts).
 */
export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Refresh token issued at login/refresh. Omit when the gh_refresh cookie is present.',
  })
  @IsOptional()
  @IsJWT()
  refreshToken?: string;
}
