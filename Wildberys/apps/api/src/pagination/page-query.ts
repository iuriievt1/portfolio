import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const defaultPageSize = 50;
export const maxPageSize = 100;

/** Query parameters of every list that is read page by page. A list adds its own filters on top. */
export class PageQuery {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: maxPageSize,
    default: defaultPageSize,
    description: 'How many items to return.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(maxPageSize)
  readonly limit: number = defaultPageSize;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The nextCursor of the previous page. Leave it out for the first page.',
  })
  @IsOptional()
  @IsUUID()
  readonly cursor?: string;
}
