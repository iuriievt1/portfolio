import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/public.decorator.js';
import { CategorySection, CategoryTreeQuery } from './categories.dto.js';
import { CategoriesService } from './categories.service.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'The category tree of the catalog',
    description: 'Sections and their subcategories that are in use, in the order of the catalog.',
  })
  @ApiOkResponse({ type: [CategorySection] })
  tree(@Query() query: CategoryTreeQuery): Promise<CategorySection[]> {
    return this.categories.tree(query.locale);
  }
}
