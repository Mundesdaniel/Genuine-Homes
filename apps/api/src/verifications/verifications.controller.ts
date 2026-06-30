import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, type Paginated, type VerificationResponse } from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SELLER_ROLES } from '../common/roles';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { VerificationsService } from './verifications.service';

@ApiTags('verifications')
@Controller('verifications')
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}

  @Post()
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit documents to verify a property you own' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationDto,
  ): Promise<VerificationResponse> {
    return this.verifications.submit(user, dto);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: the pending verification queue' })
  listPending(
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<VerificationResponse>> {
    return this.verifications.listPending(query.page, query.pageSize);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: approve or reject a verification' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVerificationDto,
  ): Promise<VerificationResponse> {
    return this.verifications.review(user, id, dto);
  }
}
