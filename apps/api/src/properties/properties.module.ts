import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesRepository } from './properties.repository';
import { PropertiesService } from './properties.service';

/**
 * Properties feature module. PropertiesService is exported so the listings
 * module can reuse ownership checks via the repository if needed later.
 */
@Module({
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertiesRepository],
  exports: [PropertiesService, PropertiesRepository],
})
export class PropertiesModule {}
