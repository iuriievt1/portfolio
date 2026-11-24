const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sellers and their documents have UUIDs. An address typed by hand and a call
 * from the browser may hold anything, so an id is checked before the API is asked.
 */
export function isId(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}
