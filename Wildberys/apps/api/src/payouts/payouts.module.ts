import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { LiveEventsModule } from '../live-events/live-events.module.js';
import { PayoutAccountsService } from './payout-accounts.service.js';
import { PayoutProvider } from './payout-provider.js';
import { SimulatedPayoutProvider } from './simulated-payout-provider.js';

@Module({
  imports: [AuditModule, LiveEventsModule],
  providers: [
    { provide: PayoutProvider, useClass: SimulatedPayoutProvider },
    PayoutAccountsService,
  ],
  exports: [PayoutAccountsService],
})
export class PayoutsModule {}
