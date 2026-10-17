import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocksService } from './locks.service.js';
import { AcquireLockDto } from './dto/acquire-lock.dto.js';
import { ReleaseLockDto } from './dto/release-lock.dto.js';

@ApiTags('Locks')
@ApiBearerAuth()
@Controller('v1/locks')
export class LocksController {
  constructor(private readonly locksService: LocksService) {}

  @Post('acquire')
  @ApiOkResponse({ description: 'Acquire a resource lock (SET NX PX)' })
  acquire(@Body() dto: AcquireLockDto) {
    return this.locksService.acquire(dto);
  }

  @Post('release')
  @ApiOkResponse({ description: 'Release a lock if the token still owns it' })
  release(@Body() dto: ReleaseLockDto) {
    return this.locksService.release(dto);
  }
}
