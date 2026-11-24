'use client';

import { ArrowDown, ArrowLeft, ChevronDown, ChevronUp, LoaderCircle, Send } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

import { maxOlderInboxPages } from '../inbox-paging';
import { initials } from './avatar';
import { Button } from './button';
import { Conversation, type ConversationEntry } from './conversation';
import { FormError } from './form-error';
import { RunWhenShown } from './run-when-shown';
import { TextArea } from './text-area';
import { TextField } from './text-field';

/** What sending answers with: done, or the code of what went wrong. */
type SendResult = { readonly ok: true } | { readonly ok: false; readonly code: string };

interface InboxPanesProps {
  /** The conversations, as InboxRow elements. */
  readonly list: ReactNode;
  /** The open conversation: the page under the layout of the inbox. */
  readonly children: ReactNode;
}

/**
 * An inbox the way a mail app draws it: the conversations on the left, the open one on the right.
 * Where both do not fit side by side, the list is shown until a conversation is opened.
 * It takes the height the page has left, and a long list or a long conversation scrolls inside it.
 * It stands in the layout of the inbox, and the pages under it are the open conversation.
 */
export function InboxPanes({ list, children }: InboxPanesProps) {
  return (
    // What is open is not known ahead only on a page with an id in its address, and such a page
    // is an open conversation. So that is how the inbox is drawn until the address is there.
    <Suspense
      fallback={
        <Panes list={list} open>
          {children}
        </Panes>
      }
    >
      <PanesOfThisPage list={list}>{children}</PanesOfThisPage>
    </Suspense>
  );
}

function PanesOfThisPage({ list, children }: InboxPanesProps) {
  return (
    <Panes list={list} open={useSelectedLayoutSegment() !== null}>
      {children}
    </Panes>
  );
}

function Panes({ list, open, children }: InboxPanesProps & { readonly open: boolean }) {
  return (
    <div className="@container relative min-h-136 w-full flex-1">
      <div className="absolute inset-0 grid grid-rows-[minmax(0,1fr)] overflow-hidden rounded-lg border border-gray-200 bg-white @3xl:grid-cols-[21rem_minmax(0,1fr)]">
        <div
          className={`min-h-0 min-w-0 flex-col border-gray-200 @3xl:flex @3xl:border-r ${open ? 'hidden' : 'flex'}`}
        >
          {list}
        </div>
        <div className={`min-h-0 min-w-0 flex-col @3xl:flex ${open ? 'flex' : 'hidden'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A conversation as the list shows it. Plain data, so a later page of the list can come from the server. */
export interface InboxRowData {
  /** The id of the conversation: the last part of the address of its page. */
  readonly id: string;
  readonly href: Route;
  /** Who the conversation is with. */
  readonly sender: string;
  readonly subject: string;
  /** The start of the last message. */
  readonly preview: string;
  /** When the last message was written, in a few characters. */
  readonly time: string;
  /** How many messages wait to be read. */
  readonly unread: number;
}

/** A page of the list of an inbox, and where the next one starts. Null when there is none. */
export interface InboxRowsPage {
  readonly rows: readonly InboxRowData[];
  readonly nextCursor: string | null;
}

interface InboxListProps extends InboxRowsPage {
  /** Drawn in the circle in front of every row, in place of the initials of the sender. */
  readonly avatar?: ReactNode;
  /** The button under the list that brings the next page. */
  readonly olderLabel: string;
  /**
   * Reads the conversations after the first page: so many pages, starting at a cursor.
   * Undefined when they cannot be read.
   */
  readonly loadOlder: (cursor: string, depth: number) => Promise<InboxRowsPage | undefined>;
}

/**
 * The conversations of an inbox, the one written in last on top. The first page comes with
 * the inbox, and the button under the list brings the older ones, a page at a time.
 */
export function InboxList({ rows, nextCursor, avatar, olderLabel, loadOlder }: InboxListProps) {
  /** How many pages after the first one a person asked for. */
  const [depth, setDepth] = useState(0);
  const [older, setOlder] = useState<{ readonly depth: number; readonly page: InboxRowsPage }>();

  // The first page comes again after every change in the inbox. The pages after it are read again
  // with it, from where it ends now, so the list has no gap and its numbers are not old.
  useEffect(() => {
    if (depth === 0 || !nextCursor) {
      return;
    }

    let current = true;
    const keep = (page: InboxRowsPage | undefined) => {
      if (current) {
        if (page) {
          setOlder({ depth, page });
        } else {
          // Not read: the button is free again.
          setDepth((asked) => (asked === depth ? depth - 1 : asked));
        }
      }
    };

    void loadOlder(nextCursor, depth).then(keep, () => {
      keep(undefined);
    });

    return () => {
      current = false;
    };
  }, [rows, nextCursor, depth, loadOlder]);

  const loaded = nextCursor && depth > 0 ? older : undefined;
  const busy = depth > 0 && older?.depth !== depth;
  const more = loaded ? loaded.page.nextCursor !== null : nextCursor !== null;
  // While the pages are read again, a conversation that moved up is not drawn twice.
  const shown = new Set(rows.map(({ id }) => id));
  const olderRows = loaded?.page.rows.filter(({ id }) => !shown.has(id)) ?? [];

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      {[...rows, ...olderRows].map((row) => (
        <InboxRow key={row.id} {...row} avatar={avatar} />
      ))}
      {more && depth < maxOlderInboxPages ? (
        <Button
          variant="ghost"
          size="sm"
          className="m-3 flex-none"
          disabled={busy}
          onClick={() => {
            setDepth(depth + 1);
          }}
        >
          {olderLabel}
          {busy ? <LoaderCircle className="animate-spin" /> : <ChevronDown />}
        </Button>
      ) : null}
    </div>
  );
}

interface InboxRowProps extends InboxRowData {
  /** Drawn in the circle in front, in place of the initials of the sender. */
  readonly avatar?: ReactNode;
}

/** One conversation in the list of an inbox. An unread one is bold and carries a number. */
function InboxRow({ id, href, avatar, sender, subject, preview, time, unread }: InboxRowProps) {
  const active = useSelectedLayoutSegment() === id;
  const row = useRef<HTMLAnchorElement>(null);

  // The open conversation stays in sight in the list, for example a letter that was just sent.
  useEffect(() => {
    if (active) {
      row.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [active]);

  return (
    <Link
      ref={row}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex gap-3 border-b border-gray-200 px-4 py-3.5 transition-colors outline-none hover:bg-berry-50 focus-visible:bg-berry-50 ${
        active ? 'bg-berry-50' : ''
      }`}
    >
      <span className="flex size-10 flex-none items-center justify-center overflow-hidden rounded-full bg-berry-100 text-[13px] font-extrabold text-berry-600 [&_svg]:size-5">
        {avatar ?? initials(sender)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-[13px] ${unread > 0 ? 'font-extrabold text-berry-950' : 'font-semibold text-gray-600'}`}
          >
            {sender}
          </span>
          <span className="flex-none text-xs font-semibold text-gray-600">{time}</span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-[15px] ${unread > 0 ? 'font-extrabold' : 'font-semibold'}`}
          >
            {subject}
          </span>
          {unread > 0 ? (
            <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-pink-500 px-1.5 text-[11px] font-extrabold text-white tabular-nums">
              {unread}
            </span>
          ) : null}
        </span>
        <span className="truncate text-[13px] font-medium text-gray-600">{preview}</span>
      </span>
    </Link>
  );
}

interface InboxHeaderProps {
  readonly title: string;
  /** A button at the end of the line, for example "new message". */
  readonly action?: ReactNode;
}

/** The line above the list of an inbox. */
export function InboxHeader({ title, action }: InboxHeaderProps) {
  return (
    <div className="flex h-15 flex-none items-center justify-between gap-3 border-b border-gray-200 px-4">
      <h2 className="text-base font-extrabold">{title}</h2>
      {action}
    </div>
  );
}

/** A page of earlier messages of a conversation, oldest first. */
export interface EarlierEntriesPage {
  readonly entries: readonly ConversationEntry[];
  /** The conversation has messages before these too. */
  readonly hasEarlier: boolean;
}

/** How a long conversation reaches the messages before the ones that came with the page. */
export interface EarlierMessagesSource {
  /** The button above the messages. */
  readonly label: string;
  /** Reads the page of messages before the one with the given id. Undefined when it cannot be read. */
  readonly load: (before: string) => Promise<EarlierEntriesPage | undefined>;
}

/** What the other side wrote and the person has not read yet. */
export interface UnreadMessages {
  /** The id of the newest of these messages. */
  readonly newest: string;
  /**
   * Reads the conversation: a server action. It runs once that message has been on the screen,
   * in a tab the person looks at. A person who reads earlier messages has not read it yet.
   */
  readonly read: () => Promise<unknown>;
}

/** A person this close to the end of a conversation, in pixels, is looking at its end. */
const endSlackPixels = 80;

/**
 * What is already on the screen together with what just came: every message once, in the order
 * of the ids. The ids of messages grow with time, so that is the order they were written in.
 */
function withNew(
  known: readonly ConversationEntry[],
  came: readonly ConversationEntry[],
): ConversationEntry[] {
  const byId = new Map([...known, ...came].map((entry) => [entry.id, entry]));

  return [...byId.values()].sort((one, other) => (one.id < other.id ? -1 : 1));
}

interface ThreadFrameProps {
  /** The subject of the conversation. */
  readonly title: string;
  /** Who it is with, under the subject. */
  readonly subtitle?: ReactNode;
  /** Where the arrow leads on a narrow screen: back to the list. */
  readonly backHref: Route;
  readonly backLabel: string;
  /** Shown at the end of the line of the title, for example a link to the seller. */
  readonly aside?: ReactNode;
  /**
   * The newest messages of the conversation, oldest first. They come again with every reading
   * of the page, and the frame adds what is new to what it already shows.
   */
  readonly entries?: readonly ConversationEntry[];
  /** Set when the conversation has more messages than came with the page. */
  readonly earlier?: EarlierMessagesSource;
  /** The button that leads to a message that came while the person was reading earlier ones. */
  readonly unseenLabel?: string;
  /** Set while the other side wrote something the person has not read. */
  readonly unread?: UnreadMessages;
  /** What stands under the messages: the field for an answer, or a note that nobody can write. */
  readonly footer?: ReactNode;
  /** Anything else for the middle of the frame, for example the form of a new letter. */
  readonly children?: ReactNode;
}

/**
 * An open conversation: its subject on top, the messages in the middle, the answer at the bottom.
 *
 * It opens at its newest message. A message that comes while the page is open is added at the end.
 * A person who looks at the end sees it at once. A person who reads earlier messages stays where
 * they are and gets a button that leads to it, and only then has read it. A long conversation
 * comes with its newest messages, and a button above them brings the earlier ones.
 */
export function ThreadFrame({
  title,
  subtitle,
  backHref,
  backLabel,
  aside,
  entries,
  earlier,
  unseenLabel,
  unread,
  footer,
  children,
}: ThreadFrameProps) {
  const messages = useRef<HTMLDivElement>(null);
  /** The person looks at the end of the conversation, so a new message may move it. */
  const atEnd = useRef(true);
  /** How far from the end the messages stood before a page was added on top. */
  const fromEnd = useRef<number>(undefined);
  const [known, setKnown] = useState({ came: entries, all: entries ?? [] });
  /** Everything before the first message on the screen is read. A conversation that came whole starts so. */
  const [fromStart, setFromStart] = useState(earlier === undefined);
  const [busy, startTransition] = useTransition();

  // The page was read again: what it brought is added to what is already here.
  if (known.came !== entries) {
    setKnown({ came: entries, all: withNew(known.all, entries ?? []) });
  }

  const first = known.all.at(0);
  const last = known.all.at(-1);
  const newest = last?.id;
  const newestMine = last?.mine ?? false;
  /** The newest message the person has had on the screen. */
  const [seen, setSeen] = useState(newest);

  useEffect(() => {
    const box = messages.current;

    if (!box || newest === undefined) {
      return;
    }

    if (atEnd.current || newestMine) {
      box.scrollTop = box.scrollHeight;
    }

    // Once the browser has drawn it: is the newest message on the screen?
    const frame = requestAnimationFrame(() => {
      if (box.scrollHeight - box.scrollTop - box.clientHeight < endSlackPixels) {
        atEnd.current = true;
        setSeen(newest);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [newest, newestMine]);

  // Messages added on top would push away what a person was reading, so it is put back in place.
  useLayoutEffect(() => {
    const box = messages.current;

    if (box && fromEnd.current !== undefined) {
      box.scrollTop = box.scrollHeight - fromEnd.current;
      fromEnd.current = undefined;
    }
  }, [known]);

  return (
    <>
      <div className="flex min-h-15 flex-none items-center gap-3 border-b border-gray-200 px-4 py-2.5">
        <Link
          href={backHref}
          aria-label={backLabel}
          title={backLabel}
          className="flex size-9 flex-none items-center justify-center rounded-sm text-berry-950 transition-colors outline-none hover:bg-gray-100 focus-visible:ring-4 focus-visible:ring-berry-500/14 @3xl:hidden [&_svg]:size-4.5"
        >
          <ArrowLeft />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-base font-extrabold">{title}</h2>
          {subtitle ? (
            <span className="truncate text-[13px] font-semibold text-gray-600">{subtitle}</span>
          ) : null}
        </div>
        {aside}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={messages}
          className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-gray-50 px-4 py-5"
          onScroll={({ currentTarget: box }) => {
            atEnd.current = box.scrollHeight - box.scrollTop - box.clientHeight < endSlackPixels;

            if (atEnd.current && seen !== newest) {
              setSeen(newest);
            }
          }}
        >
          {earlier && first && !fromStart ? (
            <Button
              variant="ghost"
              size="sm"
              className="flex-none self-center"
              disabled={busy}
              onClick={() => {
                startTransition(async () => {
                  const page = await earlier.load(first.id);

                  if (page) {
                    const box = messages.current;

                    fromEnd.current = box ? box.scrollHeight - box.scrollTop : undefined;
                    setKnown(({ came, all }) => ({ came, all: withNew(all, page.entries) }));
                    setFromStart(!page.hasEarlier);
                  }
                });
              }}
            >
              {earlier.label}
              {busy ? <LoaderCircle className="animate-spin" /> : <ChevronUp />}
            </Button>
          ) : null}
          {known.all.length > 0 ? <Conversation entries={known.all} /> : null}
          {children}
          {/* The ids grow with time, so a message at or before the newest one seen was on the screen. */}
          {unread && seen !== undefined && unread.newest <= seen ? (
            <RunWhenShown key={unread.newest} action={unread.read} />
          ) : null}
        </div>
        {unseenLabel && newest !== seen && !newestMine ? (
          <Button
            size="sm"
            pill
            className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md"
            onClick={() => {
              messages.current?.scrollTo({
                top: messages.current.scrollHeight,
                behavior: 'smooth',
              });
            }}
          >
            {unseenLabel}
            <ArrowDown />
          </Button>
        ) : null}
      </div>
      {footer ? <div className="flex-none border-t border-gray-200 p-3">{footer}</div> : null}
    </>
  );
}

interface ReplyBoxProps {
  /** What the field is for. Shown inside it while it is empty. */
  readonly label: string;
  readonly sendLabel: string;
  readonly maxLength: number;
  /** Texts by the error code. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  /** Sends the answer. The page draws the conversation again by itself. */
  readonly send: (body: string) => Promise<SendResult>;
}

/** The answer under a conversation: one box with the text and the button. A sent answer leaves the box. */
export function ReplyBox({ label, sendLabel, maxLength, errors, send }: ReplyBoxProps) {
  const [body, setBody] = useState('');
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await send(body.trim());

          if (result.ok) {
            setBody('');
            setErrorCode(undefined);
          } else {
            setErrorCode(result.code);
          }
        });
      }}
    >
      <div className="flex items-end gap-2 rounded-md border-[1.5px] border-gray-300 bg-white p-1.5 transition-shadow focus-within:border-berry-500 focus-within:ring-4 focus-within:ring-berry-500/14">
        <textarea
          aria-label={label}
          placeholder={label}
          name="body"
          rows={2}
          required
          maxLength={maxLength}
          value={body}
          className="min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] font-medium text-berry-950 outline-none placeholder:text-gray-400"
          onChange={(event) => {
            setErrorCode(undefined);
            setBody(event.target.value);
          }}
        />
        <Button type="submit" disabled={busy || body.trim().length === 0}>
          {sendLabel}
          {busy ? <LoaderCircle className="animate-spin" /> : <Send />}
        </Button>
      </div>
      {errorCode ? <FormError>{errors[errorCode] ?? errors.UNKNOWN ?? ''}</FormError> : null}
    </form>
  );
}

interface NewConversationFormProps {
  readonly subjectLabel: string;
  readonly bodyLabel: string;
  /** A short line under the text, for example how the other side learns about it. */
  readonly hint?: string;
  readonly sendLabel: string;
  readonly subjectMaxLength: number;
  readonly bodyMaxLength: number;
  /** Texts by the error code. UNKNOWN is used for a code that has no text. */
  readonly errors: Readonly<Record<string, string>>;
  /** Opens the conversation. When it works, the action itself leads to the new conversation. */
  readonly send: (subject: string, body: string) => Promise<SendResult>;
}

/** A new letter: a subject and a text. */
export function NewConversationForm({
  subjectLabel,
  bodyLabel,
  hint,
  sendLabel,
  subjectMaxLength,
  bodyMaxLength,
  errors,
  send,
}: NewConversationFormProps) {
  const [errorCode, setErrorCode] = useState<string>();
  const [busy, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onChange={() => {
        setErrorCode(undefined);
      }}
      onSubmit={(event) => {
        event.preventDefault();

        const fields = new FormData(event.currentTarget);
        const text = (name: string): string => {
          const value = fields.get(name);

          return typeof value === 'string' ? value.trim() : '';
        };

        startTransition(async () => {
          const result = await send(text('subject'), text('body'));

          setErrorCode(result.ok ? undefined : result.code);
        });
      }}
    >
      <TextField label={subjectLabel} name="subject" required maxLength={subjectMaxLength} />
      <TextArea
        label={bodyLabel}
        hint={hint}
        name="body"
        rows={6}
        required
        maxLength={bodyMaxLength}
      />
      {errorCode ? <FormError>{errors[errorCode] ?? errors.UNKNOWN ?? ''}</FormError> : null}
      <Button type="submit" className="self-end" disabled={busy}>
        {sendLabel}
        {busy ? <LoaderCircle className="animate-spin" /> : <Send />}
      </Button>
    </form>
  );
}
