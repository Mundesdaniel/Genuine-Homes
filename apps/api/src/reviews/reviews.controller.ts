import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  Paginated,
  ReviewResponse,
  ReviewSummary,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Review an agent/landlord (one per person; re-submitting updates it)' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    return this.reviews.submit(user, dto);
  }

  @Public()
  @Get('users/:userId')
  @ApiOperation({ summary: 'List reviews for a user' })
  listForTarget(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ReviewResponse>> {
    return this.reviews.listForTarget(userId, query.page, query.pageSize);
  }

  @Public()
  @Get('users/:userId/summary')
  @ApiOperation({ summary: 'Average rating + review count for a user' })
  summary(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ReviewSummary> {
    return this.reviews.summary(userId);
  }
}
