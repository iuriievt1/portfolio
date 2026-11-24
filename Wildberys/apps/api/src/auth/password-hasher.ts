import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { Injectable } from '@nestjs/common';

const deriveKey = promisify(argon2);

// Argon2id with the parameters OWASP recommends: 19 MiB of memory, 2 passes, 1 thread.
const memoryKibibytes = 19456;
const passes = 2;
const parallelism = 1;
const saltBytes = 16;
const hashBytes = 32;

const storedHashPattern = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([\w-]+)\$([\w-]+)$/;

/** Hashes passwords. The stored text keeps the parameters, so they can be raised later. */
@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(saltBytes);
    const hash = await deriveKey('argon2id', {
      message: password,
      nonce: salt,
      memory: memoryKibibytes,
      passes,
      parallelism,
      tagLength: hashBytes,
    });
    const parameters = `m=${String(memoryKibibytes)},t=${String(passes)},p=${String(parallelism)}`;

    return `$argon2id$v=19$${parameters}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const match = storedHashPattern.exec(storedHash);

    if (!match) {
      return false;
    }

    const [, memory, storedPasses, storedParallelism, salt, hash] = match;
    const expected = Buffer.from(String(hash), 'base64url');
    const actual = await deriveKey('argon2id', {
      message: password,
      nonce: Buffer.from(String(salt), 'base64url'),
      memory: Number(memory),
      passes: Number(storedPasses),
      parallelism: Number(storedParallelism),
      tagLength: expected.length,
    });

    return timingSafeEqual(actual, expected);
  }
}
