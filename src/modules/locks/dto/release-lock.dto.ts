import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReleaseLockDto {
  @ApiProperty({ example: 'booking:123' })
  @IsString()
  @IsNotEmpty()
  resourceKey: string;

  @ApiProperty({ example: 'e4f0c1d2-0000-0000-0000-000000000000' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
