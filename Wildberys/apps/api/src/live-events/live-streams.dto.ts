import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SellerStreamParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly sellerId!: string;
}
