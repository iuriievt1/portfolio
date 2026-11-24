import type { Prisma } from '../generated/prisma/client.js';

/** PrismaService itself or the client of a transaction: code that takes it works in both. */
export type DatabaseClient = Prisma.TransactionClient;
