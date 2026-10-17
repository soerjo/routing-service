import { ApiProperty } from '@nestjs/swagger';
import { DriverStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ enum: DriverStatus, example: DriverStatus.ONLINE })
  @IsEnum(DriverStatus)
  status: DriverStatus;
}
