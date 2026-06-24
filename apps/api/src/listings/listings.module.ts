import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { ListingsController } from './listings.controller';
import { ListingsRepository } from './listings.repository';
import { ListingsService } from './listings.service';
import { PropertyListingsController } from './property-listings.controller';

/**
 * Listings feature module. Imports PropertiesModule to reuse its repository for
 * ownership checks and PostGIS coordinate lookups.
 */
@Module({
  imports: [PropertiesModule],
  controllers: [ListingsController, PropertyListingsController],
  providers: [ListingsService, ListingsRepository],
})
export class ListingsModule {}
