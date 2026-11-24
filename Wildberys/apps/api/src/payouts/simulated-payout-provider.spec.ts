import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PayoutAccountStatus, PayoutMethod } from '../generated/prisma/enums.js';
import {
  simulatedCheckMilliseconds,
  SimulatedPayoutProvider,
} from './simulated-payout-provider.js';

const sellerId = '0193a7c2-0000-7000-8000-000000000001';

describe('SimulatedPayoutProvider', () => {
  const provider = new SimulatedPayoutProvider();
  const submittedAt = new Date('2026-11-17T10:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a new account every time', async () => {
    const first = await provider.openAccount(PayoutMethod.BANK, sellerId);
    const second = await provider.openAccount(PayoutMethod.STRIPE, sellerId);

    expect(first).toMatch(/^acct_simulated_[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
  });

  it('checks a seller for a short while after the form is finished', async () => {
    vi.setSystemTime(submittedAt.getTime() + simulatedCheckMilliseconds - 1);

    expect(await provider.checkAccount({ id: 'acct_simulated_1', submittedAt })).toBe(
      PayoutAccountStatus.PENDING,
    );
  });

  it('passes every seller when the while is over', async () => {
    vi.setSystemTime(submittedAt.getTime() + simulatedCheckMilliseconds);

    expect(await provider.checkAccount({ id: 'acct_simulated_1', submittedAt })).toBe(
      PayoutAccountStatus.VERIFIED,
    );
  });
});
