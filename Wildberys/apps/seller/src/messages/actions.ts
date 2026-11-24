'use server';

import { sellerInboxMarkRead, sellerInboxOpen, sellerInboxSend } from '@bluberi/api-client';
import {
  done,
  failure,
  invalidInput,
  succeeded,
  type ActionResult,
} from '@bluberi/web-auth/action-result';
import type { EarlierEntriesPage, InboxRowsPage } from '@bluberi/ui/components/inbox';
import { readOlderInboxPages } from '@bluberi/ui/inbox-paging';
import { userApiClient } from '@bluberi/web-auth/user-api-client';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';

import { authConfig } from '../auth/config';
import { localizedPath } from '../i18n/paths';
import {
  conversationPath,
  getConversation,
  getInbox,
  getWorkplaceId,
  messageMaxLength,
  subjectMaxLength,
} from './messages';
import { entriesOf, inboxRowsOf } from './rows';

// What comes from the browser is checked before it is used. The seller is never taken from the browser:
// it is the one the signed-in person works for.

/** The same code the API answers with when nobody is signed in. */
const unauthenticated = { ok: false, code: 'UNAUTHENTICATED' } as const;

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

/** Writes to the Bluberi team about something new, and opens the conversation that it starts. */
export async function openConversation(
  locale: string,
  subject: unknown,
  body: unknown,
): Promise<ActionResult> {
  if (!isText(subject, subjectMaxLength) || !isText(body, messageMaxLength)) {
    return invalidInput;
  }

  const sellerId = await getWorkplaceId();
  const client = await userApiClient(authConfig());

  if (!sellerId || !client) {
    return unauthenticated;
  }

  const { data, error } = await sellerInboxOpen({
    client,
    path: { sellerId },
    body: { subject, body },
  });

  if (!data) {
    return failure(error);
  }

  // The list of the inbox stays on the screen through the move, so it is told to read itself again.
  refresh();
  redirect(localizedPath(conversationPath(data.id), locale));
}

/** Answers in a conversation. The inbox is drawn again with the answer in it. */
export async function sendMessage(conversationId: string, body: unknown): Promise<ActionResult> {
  if (!isText(body, messageMaxLength)) {
    return invalidInput;
  }

  const sellerId = await getWorkplaceId();
  const client = await userApiClient(authConfig());

  if (!sellerId || !client) {
    return unauthenticated;
  }

  const { data, error } = await sellerInboxSend({
    client,
    path: { sellerId, conversationId },
    body: { body },
  });

  if (!data) {
    return failure(error);
  }

  refresh();

  return done;
}

/** The conversations after the first page of the inbox, for the button under the list. */
export async function loadOlderConversations(
  locale: string,
  cursor: unknown,
  depth: unknown,
): Promise<InboxRowsPage | undefined> {
  if (typeof cursor !== 'string' || typeof depth !== 'number') {
    return undefined;
  }

  return readOlderInboxPages(cursor, depth, async (from) => {
    const inbox = await getInbox(from);

    return inbox
      ? { rows: await inboxRowsOf(inbox.items, locale), nextCursor: inbox.nextCursor }
      : undefined;
  });
}

/** The messages of a conversation before the ones on the screen, for the button above them. */
export async function loadEarlierMessages(
  locale: string,
  conversationId: string,
  cursor: unknown,
): Promise<EarlierEntriesPage | undefined> {
  if (typeof cursor !== 'string') {
    return undefined;
  }

  const conversation = await getConversation(conversationId, cursor);

  return conversation
    ? {
        entries: await entriesOf(conversation.messages, locale),
        hasEarlier: conversation.nextCursor !== null,
      }
    : undefined;
}

/** The seller opened a conversation: the messages of Bluberi in it count as read, and the numbers go. */
export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const sellerId = await getWorkplaceId();
  const client = await userApiClient(authConfig());

  if (!sellerId || !client) {
    return unauthenticated;
  }

  const result = await sellerInboxMarkRead({ client, path: { sellerId, conversationId } });

  if (!succeeded(result)) {
    return failure(result.error);
  }

  refresh();

  return done;
}
