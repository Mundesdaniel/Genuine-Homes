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
import {
  type Paginated,
  type PropertyDetail,
  type PropertyImageResponse,
  type PropertySummary,
} from '@genuine-homes/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { SELLER_ROLES } from '../common/roles';
import { AddImageDto } from './dto/add-image.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Post()
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a property' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePropertyDto,
  ): Promise<PropertyDetail> {
    return this.properties.create(user, dto);
  }

  // Declared before :id so "mine" isn't captured as an id.
  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current user's properties" })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<PropertySummary>> {
    return this.properties.listMine(user, query.page, query.pageSize);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a property with its gallery and listings' })
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyDetail> {
    return this.properties.getDetail(id);
  }

  @Patch(':id')
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a property you own' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<PropertyDetail> {
    return this.properties.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...SELLER_ROLES)
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete a property you own' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.properties.remove(user, id);
  }

  @Post(':id/images')
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an image to a property' })
  addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddImageDto,
  ): Promise<PropertyImageResponse> {
    return this.properties.addImage(user, id, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles(...SELLER_ROLES)
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an image from a property' })
  removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.properties.removeImage(user, id, imageId);
  }
}
