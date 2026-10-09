import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BookingResponse, Paginated } from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { DeclineBookingDto } from './dto/decline-booking.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a viewing of a listing (notifies the owner)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingResponse> {
    return this.bookings.create(user, dto);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Viewings you have requested' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<BookingResponse>> {
    return this.bookings.listMine(user, query.page, query.pageSize);
  }

  @Get('incoming')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Viewing requests on your properties (owner view)' })
  listIncoming(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<BookingResponse>> {
    return this.bookings.listIncoming(user, query.page, query.pageSize);
  }

  @Post(':id/accept')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner: accept a viewing request' })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingResponse> {
    return this.bookings.accept(user, id);
  }

  @Post(':id/decline')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Owner: decline a viewing request' })
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclineBookingDto,
  ): Promise<BookingResponse> {
    return this.bookings.decline(user, id, dto.reason ?? null);
  }

  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer: cancel a viewing you requested' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingResponse> {
    return this.bookings.cancel(user, id);
  }
}
