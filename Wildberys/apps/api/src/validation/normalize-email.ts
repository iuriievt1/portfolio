import type { TransformFnParams } from 'class-transformer';

/** The longest email address the mail standards allow. */
export const emailMaxLength = 254;

/** Emails are stored and compared in lowercase. Use it with @Transform on every email field. */
export function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
