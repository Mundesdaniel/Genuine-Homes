import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Paginated,
  ReviewResponse,
  ReviewSummary,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapReview } from '../common/mappers';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsRepository } from './reviews.repository';

@Injectable()
export class ReviewsService {
  constructor(private readonly repo: ReviewsRepository) {}

  async submit(
    user: AuthenticatedUser,
    dto: CreateReviewDto,
  ): Promise<ReviewResponse> {
    if (dto.targetId === user.id) {
      throw new BadRequestException('You cannot review yourself');
    }
    const target = await this.repo.targetExists(dto.targetId);
    if (!target) throw new NotFoundException('User not found');

    const review = await this.repo.upsert(
      user.id,
      dto.targetId,
      dto.rating,
      dto.comment ?? null,
    );
    return mapReview(review);
  }

  async listForTarget(
    targetId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<ReviewResponse>> {
    const [rows, total] = await this.repo.listForTarget(
      targetId,
      (page - 1) * pageSize,
      pageSize,
    );
    return { items: rows.map(mapReview), total, page, pageSize };
  }

  async summary(targetId: string): Promise<ReviewSummary> {
    const { average, count } = await this.repo.summary(targetId);
    // Round the average to one decimal for display (e.g. 4.3).
    return { targetId, average: Math.round(average * 10) / 10, count };
  }
}
