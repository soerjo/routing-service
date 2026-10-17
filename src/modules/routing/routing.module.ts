import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller.js';
import { RoutingService } from './routing.service.js';
import { OsrmClient } from './osrm.client.js';

@Module({
  controllers: [RoutingController],
  providers: [RoutingService, OsrmClient],
  exports: [RoutingService],
})
export class RoutingModule {}
