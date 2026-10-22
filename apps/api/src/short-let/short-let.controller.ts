import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, type ShortLetDashboardResponse } from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { SubscriptionGuard } from '../subscriptions/guards/subscription.guard';
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
}
