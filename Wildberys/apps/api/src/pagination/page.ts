export interface Page<Item> {
  readonly items: Item[];
  /** Send it as the cursor to get the next page. Null on the last page. */
  readonly nextCursor: string | null;
}

/**
 * Cuts rows into one page. Ask the database for one row more than the page size:
 * the extra row is not returned, it only tells that another page exists.
 */
export function toPage<Row extends { readonly id: string }>(
  rows: readonly Row[],
  pageSize: number,
): Page<Row> {
  const items = rows.slice(0, pageSize);
  const last = items.at(-1);

  return { items, nextCursor: rows.length > pageSize && last ? last.id : null };
}
