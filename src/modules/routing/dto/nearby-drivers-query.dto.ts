import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_RADIUS_KM = 5;
export const DEFAULT_NEARBY_LIMIT = 10;
export const MAX_NEARBY_LIMIT = 50;

export class NearbyDriversQueryDto {
  @ApiProperty({ example: -6.2, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 106.816666, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({
    example: DEFAULT_RADIUS_KM,
    minimum: 0.01,
    default: DEFAULT_RADIUS_KM,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  radiusKm: number = DEFAULT_RADIUS_KM;

  @ApiPropertyOptional({
    example: DEFAULT_NEARBY_LIMIT,
    minimum: 1,
    maximum: MAX_NEARBY_LIMIT,
    default: DEFAULT_NEARBY_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_NEARBY_LIMIT)
  @IsOptional()
  limit: number = DEFAULT_NEARBY_LIMIT;
}
