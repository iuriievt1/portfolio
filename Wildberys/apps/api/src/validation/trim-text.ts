import type { TransformFnParams } from 'class-transformer';

/** Removes the spaces around a text a person typed. Use it with @Transform on names and links. */
export function trimText({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
