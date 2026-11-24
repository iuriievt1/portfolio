import { describe, expect, it } from 'vitest';

import { toChange } from './redis-live-events.js';

const seller = '0193a7c2-0000-7000-8000-000000000001';
const conversation = '0193a7c2-0000-7000-8000-000000000003';

describe('what comes from the channel', () => {
  it.each([
    { kind: 'conversation-changed', sellerId: seller, conversationId: conversation },
    { kind: 'seller-changed', sellerId: seller },
    { kind: 'newsletter-changed' },
  ])('is a change of the kind $kind', (change) => {
    expect(toChange(JSON.stringify(change))).toEqual(change);
  });

  it('carries nothing but what the change names', () => {
    expect(
      toChange(JSON.stringify({ kind: 'seller-changed', sellerId: seller, body: 'a secret' })),
    ).toEqual({ kind: 'seller-changed', sellerId: seller });
  });

  it.each([
    'not json',
    'null',
    '"a text"',
    JSON.stringify({ kind: 'something-new' }),
    JSON.stringify({ kind: 'seller-changed' }),
    JSON.stringify({ kind: 'seller-changed', sellerId: 'not-an-id' }),
    JSON.stringify({ kind: 'conversation-changed', sellerId: seller }),
    JSON.stringify({ kind: 'events-missed' }),
  ])('is nothing when it is not a change this version knows: %s', (message) => {
    expect(toChange(message)).toBeUndefined();
  });
});
