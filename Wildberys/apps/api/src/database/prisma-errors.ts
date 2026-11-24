import { Prisma } from '../generated/prisma/client.js';

const uniqueConstraintViolation = 'P2002';

/** True when a write failed because the value must be unique and is already taken. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === uniqueConstraintViolation
  );
}
