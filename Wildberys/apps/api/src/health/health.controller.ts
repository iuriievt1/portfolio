import { Controller, Get, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../database/prisma.service.js';
import { ApiError } from '../errors/api-error.dto.js';
import { AppException } from '../errors/app.exception.js';
import { HealthStatus } from './health.dto.js';

@ApiTags('Health')
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'The API process is running' })
  @ApiOkResponse({ type: HealthStatus, description: 'The process is running' })
  live(): HealthStatus {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'The API can serve requests: the database answers' })
  @ApiOkResponse({ type: HealthStatus, description: 'The API is ready' })
  @ApiServiceUnavailableResponse({ type: ApiError, description: 'The database does not answer' })
  async ready(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (cause) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'DATABASE_UNAVAILABLE',
        'The database does not answer',
        undefined,
        { cause },
      );
    }

    return { status: 'ok' };
  }
}
