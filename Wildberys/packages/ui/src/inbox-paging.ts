import type { InboxRowData, InboxRowsPage } from './components/inbox';

/**
 * How many pages after the first one the list of an inbox reads at most. The list stops offering
 * older conversations there, and the server action that reads them keeps to it too.
 */
export const maxOlderInboxPages = 20;

/**
 * The conversations after the first page of an inbox, as one piece: up to `depth` pages read
 * one after another from a cursor. Undefined when one of them cannot be read.
 */
export async function readOlderInboxPages(
  cursor: string,
  depth: number,
  readPage: (cursor: string) => Promise<InboxRowsPage | undefined>,
): Promise<InboxRowsPage | undefined> {
  const pages = Math.min(Math.max(Math.trunc(depth), 1), maxOlderInboxPages);
  const rows: InboxRowData[] = [];
  let next: string | null = cursor;

  for (let read = 0; read < pages && next; read += 1) {
    // Each page starts where the one before it ended, so they are read in turn.
    const page = await readPage(next);

    if (!page) {
      return undefined;
    }

    rows.push(...page.rows);
    next = page.nextCursor;
  }

  return { rows, nextCursor: next };
}
