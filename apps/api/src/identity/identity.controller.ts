import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type IdentityVerificationQueueItem,
  type IdentityVerificationResponse,
  type Paginated,
  UserRole,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SELLER_ROLES } from '../common/roles';
import { ReviewIdentityVerificationDto } from './dto/review-identity-verification.dto';
import { SubmitIdentityVerificationDto } from './dto/submit-identity-verification.dto';
import { IdentityService } from './identity.service';

@ApiTags('identity')
@Controller('identity/verifications')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post()
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  // Sensitive PII + manual review downstream — no reason for bursts.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit your National ID (KYC) for verification' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitIdentityVerificationDto,
  ): Promise<IdentityVerificationResponse> {
    return this.identity.submit(user, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Your latest identity verification (null if none)' })
  myStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IdentityVerificationResponse | null> {
    return this.identity.myStatus(user);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: the pending identity verification queue' })
  listPending(
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<IdentityVerificationQueueItem>> {
    return this.identity.listPending(query.page, query.pageSize);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: approve or reject an identity verification' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewIdentityVerificationDto,
  ): Promise<IdentityVerificationResponse> {
    return this.identity.review(user, id, dto);
  }
}
