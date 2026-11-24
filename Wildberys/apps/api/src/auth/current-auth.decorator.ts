import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { getAuthContext, type AuthContext } from './auth-context.js';

/** The signed-in user of the request, as a controller method parameter. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext =>
    getAuthContext(context.switchToHttp().getRequest<Request>()),
);
