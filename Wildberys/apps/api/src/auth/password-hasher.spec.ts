import { describe, expect, it } from 'vitest';

import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('stores the algorithm and its parameters next to the hash', async () => {
    const hash = await hasher.hash('correct horse battery');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[\w-]{22}\$[\w-]{43}$/);
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const hash = await hasher.hash('correct horse battery');

    expect(await hasher.verify('correct horse battery', hash)).toBe(true);
    expect(await hasher.verify('correct horse batterx', hash)).toBe(false);
  });

  it('gives a different hash every time', async () => {
    expect(await hasher.hash('same password')).not.toBe(await hasher.hash('same password'));
  });

  it('checks a hash made with other parameters', async () => {
    // "password" hashed with 8 MiB of memory and 1 pass.
    const weaker =
      '$argon2id$v=19$m=8192,t=1,p=1$c29tZXNhbHRzb21lc2FsdA$' + (await weakerHashOf('password'));

    expect(await hasher.verify('password', weaker)).toBe(true);
    expect(await hasher.verify('passwore', weaker)).toBe(false);
  });

  it('refuses a stored value it does not understand', async () => {
    expect(await hasher.verify('password', 'plain-text-password')).toBe(false);
    expect(await hasher.verify('password', '$2b$10$abcdefghijklmnopqrstuv')).toBe(false);
    expect(await hasher.verify('password', '')).toBe(false);
  });
});

async function weakerHashOf(password: string): Promise<string> {
  const { argon2 } = await import('node:crypto');
  const { promisify } = await import('node:util');
  const hash = await promisify(argon2)('argon2id', {
    message: password,
    nonce: Buffer.from('c29tZXNhbHRzb21lc2FsdA', 'base64url'),
    memory: 8192,
    passes: 1,
    parallelism: 1,
    tagLength: 32,
  });

  return hash.toString('base64url');
}
