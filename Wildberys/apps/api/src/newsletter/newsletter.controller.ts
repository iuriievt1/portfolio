import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePlatformAccess } from '../access/access.decorators.js';
import { Public } from '../auth/public.decorator.js';
import { PageQuery } from '../pagination/page-query.js';
import { NewsletterPage, SubscribeBody, UnsubscribeBody } from './newsletter.dto.js';
import { NewsletterService } from './newsletter.service.js';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign up for news by email',
    description: 'The answer is the same whether the email is already on the list or not.',
  })
  @ApiNoContentResponse({ description: 'The person is on the list' })
  subscribe(@Body() body: SubscribeBody): Promise<void> {
    return this.newsletter.subscribe(body);
  }

  @Public()
  @Post('removal')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Stop the news by email',
    description:
      'Takes back the consent to get news by email and deletes the subscription. The answer is the same whether the email was on the list or not.',
  })
  @ApiNoContentResponse({ description: 'The email is not on the list' })
  unsubscribe(@Body() body: UnsubscribeBody): Promise<void> {
    return this.newsletter.unsubscribe(body);
  }
}

@ApiTags('Admin: marketing')
@Controller('admin/newsletter')
@RequirePlatformAccess({ area: 'marketing', level: 'view' })
export class NewsletterAdminController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @ApiOperation({ summary: 'People who get the news by email, newest first' })
  @ApiOkResponse({ type: NewsletterPage })
  list(@Query() query: PageQuery): Promise<NewsletterPage> {
    return this.newsletter.list(query);
  }
}
