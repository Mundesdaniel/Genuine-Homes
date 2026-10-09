import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PaymentInitiation } from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { BuyDto } from './dto/buy.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post(':listingId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay a property’s full sale price at once (outright purchase)' })
  buy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: BuyDto,
  ): Promise<PaymentInitiation> {
    return this.purchases.buy(user, listingId, dto);
  }
}
