import type { Route } from 'next';
import Link from 'next/link';

import { textLinkClasses } from './text-link';

export interface ListPagingProps {
  /** Where the list is. */
  readonly path: Route;
  /** What else the address of the list holds, for example its chosen tab. */
  readonly query?: Readonly<Record<string, string>>;
  /** The cursor of the page that is shown. Nothing on the first page. */
  readonly cursor: string | undefined;
  readonly nextCursor: string | null | undefined;
  readonly first: string;
  readonly next: string;
}

/** The links under a list to its first and its next page. Nothing for a list that fits on one page. */
export function ListPaging({ path, query, cursor, nextCursor, first, next }: ListPagingProps) {
  if (cursor === undefined && !nextCursor) {
    return null;
  }

  return (
    <div className="flex gap-6 border-t border-gray-200 px-5 py-4 text-sm">
      {cursor !== undefined ? (
        <Link href={{ pathname: path, query }} className={textLinkClasses}>
          {first}
        </Link>
      ) : null}
      {nextCursor ? (
        <Link
          href={{ pathname: path, query: { ...query, cursor: nextCursor } }}
          className={textLinkClasses}
        >
          {next}
        </Link>
      ) : null}
    </div>
  );
}
