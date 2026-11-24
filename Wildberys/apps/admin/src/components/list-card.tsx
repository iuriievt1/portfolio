import type { ReactNode } from 'react';

import { ListPaging, type ListPagingProps } from './list-paging';

/** The look of a row and of a cell of a list. The page draws the rows, so it knows what each cell holds. */
export const listRow = 'border-b border-gray-200 font-semibold last:border-b-0';
export const listCell = 'px-5 py-3.25';

export interface ListNoteProps {
  readonly text: string;
  /** The list could not be read. Otherwise it is empty. */
  readonly failed: boolean;
}

/** Said in place of the rows of a list: the list could not be read, or it is empty. */
export function ListNote({ text, failed }: ListNoteProps) {
  return (
    <p
      role={failed ? 'alert' : undefined}
      className={`px-5 py-6 text-sm font-semibold ${failed ? 'text-red-500' : 'text-gray-600'}`}
    >
      {text}
    </p>
  );
}

interface ListCardProps {
  readonly title: string;
  /** What the list holds and where it comes from. */
  readonly text: string;
  /** The names of the columns. */
  readonly columns: readonly string[];
  /** Said in place of the rows: the list could not be read, or it is empty. */
  readonly note?: ListNoteProps;
  /** The rows of the table. */
  readonly children: ReactNode;
  /** Where the list is, for the links to its first and its next page. */
  readonly paging: ListPagingProps;
}

/** A list of the admin in a card: what it holds, its rows and the way to the next page. */
export function ListCard({ title, text, columns, note, children, paging }: ListCardProps) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-lg font-extrabold tracking-[-0.01em]">{title}</h2>
        <p className="mt-0.5 text-[13px] font-semibold text-gray-600">{text}</p>
      </div>
      {note ? (
        <div className="border-t border-gray-200">
          <ListNote {...note} />
        </div>
      ) : (
        // A list with many columns scrolls sideways inside its card on a narrow screen.
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-gray-200 bg-gray-50 text-left text-[11.5px] tracking-[0.07em] text-gray-600 uppercase">
                {columns.map((column) => (
                  <th key={column} className="px-5 py-3 font-extrabold whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
      <ListPaging {...paging} />
    </section>
  );
}
