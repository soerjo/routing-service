import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AcquireLockDto {
  @ApiProperty({ example: 'booking:123' })
  @IsString()
  @IsNotEmpty()
  resourceKey: string;

  @ApiPropertyOptional({ example: 30000, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  ttlMs?: number;
}
