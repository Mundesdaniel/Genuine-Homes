import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ListingResponse,
  ListingSearchItem,
  Paginated,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { SELLER_ROLES } from '../common/roles';
import { CreateListingDto } from './dto/create-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search active listings (facets + "near me")' })
  search(
    @Query() query: SearchListingsDto,
  ): Promise<Paginated<ListingSearchItem>> {
    return this.listings.search(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a listing with its property' })
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<ListingSearchItem> {
    return this.listings.getOne(id);
  }

  @Patch(':id')
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a listing on a property you own' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<ListingResponse> {
    return this.listings.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...SELLER_ROLES)
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate (soft-delete) a listing you own' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.listings.remove(user, id);
  }
}
