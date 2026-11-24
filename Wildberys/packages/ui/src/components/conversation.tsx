import type { ReactNode } from 'react';

export interface ConversationEntry {
  readonly id: string;
  /** Written by the side that looks at the conversation. */
  readonly mine: boolean;
  /** Who wrote it and when, in one line. */
  readonly caption: string;
  readonly body: string;
  /** Set for a decision or another event: its name. It is then drawn as a note, not as a bubble. */
  readonly title?: string;
  /** Shown inside a note, for example a link to what the decision asks for. */
  readonly action?: ReactNode;
}

/**
 * A conversation between two sides, oldest first: what this side wrote stands on the right,
 * what the other side wrote on the left, and events like decisions run across as notes.
 */
export function Conversation({ entries }: { readonly entries: readonly ConversationEntry[] }) {
  return (
    <ol className="flex flex-col gap-3.5">
      {entries.map(({ id, mine, caption, body, title, action }) =>
        title ? (
          <li
            key={id}
            className="flex flex-col gap-1.5 rounded-md border border-berry-200 bg-berry-50 px-4 py-3"
          >
            <span className="text-sm font-extrabold text-berry-700">{title}</span>
            {body ? (
              <p className="text-[15px] font-medium break-words whitespace-pre-line">{body}</p>
            ) : null}
            {action}
            <span className="text-xs font-semibold text-gray-600">{caption}</span>
          </li>
        ) : (
          <li
            key={id}
            className={`flex max-w-[85%] flex-col gap-1 ${mine ? 'items-end self-end' : 'items-start self-start'}`}
          >
            <p
              className={`rounded-lg px-3.5 py-2.5 text-[15px] font-medium break-words whitespace-pre-line ${
                mine
                  ? 'rounded-br-xs bg-berry-500 text-white'
                  : 'rounded-bl-xs border border-gray-200 bg-white'
              }`}
            >
              {body}
            </p>
            <span className="px-1 text-xs font-semibold text-gray-600">{caption}</span>
          </li>
        ),
      )}
    </ol>
  );
}
