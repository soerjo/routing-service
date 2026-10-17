import { Body, Controller, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DriverLocationService } from './driver-location.service.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@ApiTags('Driver Location')
@ApiBearerAuth()
@Roles('DRIVER')
@Controller('v1/driver')
export class DriverLocationController {
  constructor(private readonly driverLocationService: DriverLocationService) {}

  @Post('location')
  @ApiOkResponse({ description: 'Publish driver location + heartbeat' })
  updateLocation(
    @CurrentUser('id') driverId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.driverLocationService.updateLocation(driverId, dto);
  }

  @Patch('status')
  @ApiOkResponse({ description: 'Update driver availability status' })
  updateStatus(
    @CurrentUser('id') driverId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.driverLocationService.updateStatus(driverId, dto);
  }
}
