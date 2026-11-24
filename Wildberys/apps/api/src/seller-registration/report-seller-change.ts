import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { mergeMap, type Observable } from 'rxjs';

import { LiveEvents } from '../live-events/live-events.js';
import type { SellerRegistration } from './seller-registration.dto.js';

/**
 * Every step of a registration changes what the team sees of the seller, and what the other
 * people of the seller see. Once a step is saved, their open pages are told, so a registration
 * that was just sent stands in the list of the team at once. Reading the registration tells nobody.
 */
@Injectable()
export class ReportSellerChange implements NestInterceptor<SellerRegistration, SellerRegistration> {
  constructor(private readonly live: LiveEvents) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<SellerRegistration>,
  ): Observable<SellerRegistration> {
    const reads = context.switchToHttp().getRequest<Request>().method === 'GET';

    return next.handle().pipe(
      mergeMap(async (registration) => {
        if (!reads && registration.seller) {
          await this.live.report({ kind: 'seller-changed', sellerId: registration.seller.id });
        }

        return registration;
      }),
    );
  }
}
