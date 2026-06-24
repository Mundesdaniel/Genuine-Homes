import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListingResponse } from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { SELLER_ROLES } from '../common/roles';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsService } from './listings.service';

/** Listings are created under their parent property (ownership is on the property). */
@ApiTags('listings')
@Controller('properties/:propertyId/listings')
export class PropertyListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Post()
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a listing on a property you own' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateListingDto,
  ): Promise<ListingResponse> {
    return this.listings.create(user, propertyId, dto);
  }
}
