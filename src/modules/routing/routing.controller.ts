import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RoutingService } from './routing.service.js';
import { RouteQueryDto } from './dto/route-query.dto.js';
import { NearbyDriversQueryDto } from './dto/nearby-drivers-query.dto.js';

@ApiTags('Routing')
@ApiBearerAuth()
@Controller('v1/routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get('route')
  @ApiOkResponse({ description: 'Driving route between two points' })
  getRoute(@Query() query: RouteQueryDto) {
    return this.routingService.getRoute(query);
  }

  @Get('nearby-drivers')
  @ApiOkResponse({ description: 'Active drivers near a point, nearest first' })
  getNearbyDrivers(@Query() query: NearbyDriversQueryDto) {
    return this.routingService.findNearbyDrivers(query);
  }
}
