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
import type {
  Paginated,
  PaymentInitiation,
  RentalAgreementResponse,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateRentalDto } from './dto/create-rental.dto';
import { PayRentDto } from './dto/pay-rent.dto';
import { RentalsService } from './rentals.service';

@ApiTags('rentals')
@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a rental agreement from a rent listing' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRentalDto,
  ): Promise<RentalAgreementResponse> {
    return this.rentals.create(user, dto);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List rental agreements where you are the tenant' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<RentalAgreementResponse>> {
    return this.rentals.listMine(user, query.page, query.pageSize);
  }

  @Get('incoming')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List agreements on your listings (landlord view)" })
  listIncoming(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<RentalAgreementResponse>> {
    return this.rentals.listIncoming(user, query.page, query.pageSize);
  }

  @Post(':id/pay-rent')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Pay one month's rent (activates the agreement once settled)" })
  payRent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayRentDto,
  ): Promise<PaymentInitiation> {
    return this.rentals.payRent(user, id, dto);
  }

  @Post(':id/terminate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End an agreement early (tenant, landlord, or admin)' })
  terminate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RentalAgreementResponse> {
    return this.rentals.terminate(user, id);
  }
}
