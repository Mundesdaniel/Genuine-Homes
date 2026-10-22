import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type ShortLetAvailabilityBlockResponse,
  type ShortLetBookingResponse,
  type ShortLetDashboardResponse,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { SubscriptionGuard } from '../subscriptions/guards/subscription.guard';
import { CreateAvailabilityBlockDto } from './dto/create-availability-block.dto';
import { CreateShortLetBookingDto } from './dto/create-short-let-booking.dto';
import { ShortLetService } from './short-let.service';

/**
 * Short-let dashboard endpoints. Restricted to the `airbnb_agent` role (global
 * RolesGuard) AND an active subscription (SubscriptionGuard).
 */
@ApiTags('short-let')
@Controller('short-let')
@Roles(UserRole.AIRBNB_AGENT)
@UseGuards(SubscriptionGuard)
export class ShortLetController {
  constructor(private readonly shortLet: ShortLetService) {}

  @Get('dashboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Short-let dashboard (airbnb_agent + active subscription)' })
  dashboard(@CurrentUser() user: AuthenticatedUser): Promise<ShortLetDashboardResponse> {
    return this.shortLet.dashboard(user);
  }

  @Post('bookings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a short-let stay (income + nights)' })
  createBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShortLetBookingDto,
  ): Promise<ShortLetBookingResponse> {
    return this.shortLet.createBooking(user, dto);
  }

  @Post('availability')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Block a date range as unavailable' })
  createBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAvailabilityBlockDto,
  ): Promise<ShortLetAvailabilityBlockResponse> {
    return this.shortLet.createBlock(user, dto);
  }
}
