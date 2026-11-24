'use server';

import { teamInboxMarkRead, teamInboxSend, teamNewConversationOpen } from '@bluberi/api-client';
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
import { isId } from '../sellers/ids';
import {
  conversationPath,
  getTeamConversation,
  getTeamInbox,
  messageMaxLength,
  subjectMaxLength,
} from './inbox';
import { entriesOf, inboxRowsOf } from './rows';

// What comes from the browser is checked before it is used.

/** The same code the API answers with when nobody is signed in. */
const unauthenticated = { ok: false, code: 'UNAUTHENTICATED' } as const;

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

/** Writes to a seller about something new, and opens the conversation that it starts. */
export async function openSellerConversation(
  sellerId: unknown,
  subject: unknown,
  body: unknown,
): Promise<ActionResult> {
  if (!isId(sellerId) || !isText(subject, subjectMaxLength) || !isText(body, messageMaxLength)) {
    return invalidInput;
  }

  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const { data, error } = await teamNewConversationOpen({
    client,
    path: { sellerId },
    body: { subject, body },
  });

  if (!data) {
    return failure(error);
  }

  // An inbox that is already on a screen is told to read itself again.
  refresh();
  redirect(conversationPath(data.id));
}

/** Answers a seller. The inbox is drawn again with the answer in it. */
export async function sendTeamMessage(
  conversationId: unknown,
  body: unknown,
): Promise<ActionResult> {
  if (!isId(conversationId) || !isText(body, messageMaxLength)) {
    return invalidInput;
  }

  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const { data, error } = await teamInboxSend({
    client,
    path: { conversationId },
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
  cursor: unknown,
  depth: unknown,
): Promise<InboxRowsPage | undefined> {
  if (!isId(cursor) || typeof depth !== 'number') {
    return undefined;
  }

  return readOlderInboxPages(cursor, depth, async (from) => {
    const inbox = await getTeamInbox(undefined, from);

    return inbox
      ? { rows: await inboxRowsOf(inbox.items), nextCursor: inbox.nextCursor }
      : undefined;
  });
}

/** The messages of a conversation before the ones on the screen, for the button above them. */
export async function loadEarlierMessages(
  conversationId: unknown,
  cursor: unknown,
): Promise<EarlierEntriesPage | undefined> {
  if (!isId(conversationId) || !isId(cursor)) {
    return undefined;
  }

  const conversation = await getTeamConversation(conversationId, cursor);

  return conversation
    ? {
        entries: await entriesOf(conversation.messages),
        hasEarlier: conversation.nextCursor !== null,
      }
    : undefined;
}

/** The team opened a conversation: what the seller wrote in it counts as read, and the numbers go. */
export async function markTeamConversationRead(conversationId: unknown): Promise<ActionResult> {
  if (!isId(conversationId)) {
    return invalidInput;
  }

  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const result = await teamInboxMarkRead({ client, path: { conversationId } });

  if (!succeeded(result)) {
    return failure(result.error);
  }

  refresh();

  return done;
}
