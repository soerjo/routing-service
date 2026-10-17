import { Module } from '@nestjs/common';
import { LocksController } from './locks.controller.js';
import { LocksService } from './locks.service.js';

@Module({
  controllers: [LocksController],
  providers: [LocksService],
})
export class LocksModule {}
