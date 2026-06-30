import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  FavoriteIdsResponse,
  ListingSearchItem,
  Paginated,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the properties you have saved' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ListingSearchItem>> {
    return this.favorites.listMine(user, query.page, query.pageSize);
  }

  // Declared before :propertyId so "ids" isn't captured as a uuid param.
  @Get('ids')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ids of your saved properties (to mark cards)' })
  listIds(@CurrentUser() user: AuthenticatedUser): Promise<FavoriteIdsResponse> {
    return this.favorites.listIds(user);
  }

  @Post(':propertyId')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save a property (idempotent)' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<void> {
    return this.favorites.add(user, propertyId);
  }

  @Delete(':propertyId')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a saved property' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<void> {
    return this.favorites.remove(user, propertyId);
  }
}
