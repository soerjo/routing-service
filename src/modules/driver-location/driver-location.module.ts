import { Module } from '@nestjs/common';
import { DriverLocationController } from './driver-location.controller.js';
import { DriverLocationService } from './driver-location.service.js';

@Module({
  controllers: [DriverLocationController],
  providers: [DriverLocationService],
})
export class DriverLocationModule {}
