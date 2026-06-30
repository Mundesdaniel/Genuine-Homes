import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { ReviewWithAuthor, ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';

const author: AuthenticatedUser = { id: 'author-1', role: UserRole.USER };

const review = (): ReviewWithAuthor =>
  ({
    id: 'rev-1',
    authorId: author.id,
    targetId: 'agent-1',
    rating: 4,
    comment: 'Helpful and honest',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    author: { id: author.id, fullName: 'Ada' },
  }) as unknown as ReviewWithAuthor;

describe('ReviewsService', () => {
  let repo: jest.Mocked<ReviewsRepository>;
  let service: ReviewsService;

  beforeEach(() => {
    repo = {
      targetExists: jest.fn().mockResolvedValue({ id: 'agent-1' }),
      upsert: jest.fn().mockResolvedValue(review()),
      listForTarget: jest.fn().mockResolvedValue([[review()], 1]),
      summary: jest.fn().mockResolvedValue({ average: 4.333, count: 3 }),
    } as unknown as jest.Mocked<ReviewsRepository>;
    service = new ReviewsService(repo);
  });

  it('submits a review for another user', async () => {
    const result = await service.submit(author, { targetId: 'agent-1', rating: 4 });
    expect(repo.upsert).toHaveBeenCalledWith(author.id, 'agent-1', 4, null);
    expect(result).toMatchObject({ rating: 4, author: { fullName: 'Ada' } });
  });

  it('rejects reviewing yourself', async () => {
    await expect(
      service.submit(author, { targetId: author.id, rating: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('404s when the target does not exist', async () => {
    repo.targetExists.mockResolvedValue(null);
    await expect(
      service.submit(author, { targetId: 'ghost', rating: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rounds the average rating to one decimal', async () => {
    expect(await service.summary('agent-1')).toEqual({
      targetId: 'agent-1',
      average: 4.3,
      count: 3,
    });
  });
});
