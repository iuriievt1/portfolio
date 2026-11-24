/** How long the message of a decision may be. The API takes the same. */
export const decisionMessageMinLength = 5;
export const decisionMessageMaxLength = 2000;

/**
 * The message of a decision the way the API takes it: without the spaces around it.
 * Undefined for a text of a wrong length and for anything that is not a text.
 */
export function decisionMessageOf(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const message = value.trim();

  return message.length >= decisionMessageMinLength && message.length <= decisionMessageMaxLength
    ? message
    : undefined;
}
