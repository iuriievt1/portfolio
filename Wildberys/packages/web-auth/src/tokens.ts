export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * What an access token says about itself. Undefined when the token cannot be read.
 * The token is only read here, not checked: the API checks it on every call.
 */
function readClaims(accessToken: string): object | undefined {
  const payload = accessToken.split('.')[1];

  if (!payload) {
    return undefined;
  }

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    return typeof claims === 'object' && claims !== null ? claims : undefined;
  } catch {
    return undefined;
  }
}

/** When an access token stops working, in milliseconds since 1970. Undefined when the token cannot be read. */
export function accessTokenExpiry(accessToken: string): number | undefined {
  const claims = readClaims(accessToken);

  return claims && 'exp' in claims && typeof claims.exp === 'number'
    ? claims.exp * 1000
    : undefined;
}

/** The session an access token belongs to. It stays the same while the tokens of the session are renewed. */
export function accessTokenSessionId(accessToken: string): string | undefined {
  const claims = readClaims(accessToken);

  return claims && 'sid' in claims && typeof claims.sid === 'string' ? claims.sid : undefined;
}
