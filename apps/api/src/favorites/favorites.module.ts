import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { FavoritesController } from './favorites.controller';
import { FavoritesRepository } from './favorites.repository';
import { FavoritesService } from './favorites.service';

/**
 * Favorites (saved properties). Imports PropertiesModule to reuse the PostGIS
 * coordinate lookup when listing saved properties as map-ready summaries.
 */
@Module({
  imports: [PropertiesModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, FavoritesRepository],
})
export class FavoritesModule {}
