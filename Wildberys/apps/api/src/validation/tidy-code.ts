import type { TransformFnParams } from 'class-transformer';

/**
 * A number or a code a person typed, the way it is stored: without the spaces around it,
 * with single spaces inside and in capital letters. Use it with @Transform.
 */
export function tidyCode({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : value;
}
