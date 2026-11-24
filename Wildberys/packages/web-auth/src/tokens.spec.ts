import { describe, expect, it } from 'vitest';

import { accessTokenExpiry, accessTokenSessionId } from './tokens';

function tokenWith(claims: unknown): string {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

/** A name for the test and the token. */
type TokenCase = [name: string, token: string];

const unreadableTokens: TokenCase[] = [
  ['a token whose middle part is not JSON', 'header.not-json.signature'],
  ['a token whose middle part is not an object', tokenWith('claims')],
  ['a text that is not a token', 'not-a-token'],
  ['an empty text', ''],
];

describe('accessTokenExpiry', () => {
  it('reads the expiry of a token in milliseconds', () => {
    expect(accessTokenExpiry(tokenWith({ sub: 'user', exp: 1_800_000_000 }))).toBe(
      1_800_000_000_000,
    );
  });

  it.each<TokenCase>([
    ['a token without an expiry', tokenWith({ sub: 'user' })],
    ['a token with a wrong expiry', tokenWith({ exp: 'tomorrow' })],
    ...unreadableTokens,
  ])('returns nothing for %s', (_name, token) => {
    expect(accessTokenExpiry(token)).toBeUndefined();
  });
});

describe('accessTokenSessionId', () => {
  it('reads the session of a token', () => {
    expect(accessTokenSessionId(tokenWith({ sub: 'user', sid: 'session-1' }))).toBe('session-1');
  });

  it.each<TokenCase>([
    ['a token without a session', tokenWith({ sub: 'user' })],
    ['a token with a wrong session', tokenWith({ sid: 42 })],
    ...unreadableTokens,
  ])('returns nothing for %s', (_name, token) => {
    expect(accessTokenSessionId(token)).toBeUndefined();
  });
});
