import { describe, expect, it } from 'vitest';

import { RegisterCheckMemory, registerCheckLifetimeMilliseconds } from './register-check-memory.js';
import type { SellerRegisterCheck } from './seller-moderation.dto.js';

const seller = '0193a7c2-0000-7000-8000-000000000001';
const other = '0193a7c2-0000-7000-8000-000000000002';
const version = 1_795_000_000_000;
const now = 1_795_000_100_000;
const check: SellerRegisterCheck = {
  result: 'MATCHES',
  differences: [],
  registerName: 'Studio Lila s.r.o.',
  registerAddress: null,
  trades: null,
  retailTrade: null,
};

describe('RegisterCheckMemory', () => {
  it('gives back what the registers said about a seller', () => {
    const memory = new RegisterCheckMemory();

    memory.keep(seller, version, check, now);

    expect(memory.find(seller, version, now + 1)).toBe(check);
    expect(memory.find(other, version, now + 1)).toBeUndefined();
  });

  it('forgets an answer after five minutes', () => {
    const memory = new RegisterCheckMemory();

    memory.keep(seller, version, check, now);

    expect(memory.find(seller, version, now + registerCheckLifetimeMilliseconds - 1)).toBe(check);
    expect(memory.find(seller, version, now + registerCheckLifetimeMilliseconds)).toBeUndefined();
  });

  it('does not answer for a seller that changed since', () => {
    const memory = new RegisterCheckMemory();

    memory.keep(seller, version, check, now);

    expect(memory.find(seller, version + 1, now + 1)).toBeUndefined();
  });

  it('drops the answers that are too old when a new one comes', () => {
    const memory = new RegisterCheckMemory();
    const later = now + registerCheckLifetimeMilliseconds;

    memory.keep(seller, version, check, now);
    memory.keep(other, version, check, later);

    // Asked about with a clock that is still before the end: the answer is gone all the same.
    expect(memory.find(seller, version, now + 1)).toBeUndefined();
    expect(memory.find(other, version, later + 1)).toBe(check);
  });
});
