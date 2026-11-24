import {
  sellerInboxInbox,
  sellerInboxThread,
  sellerInboxUnread,
  type ConversationsPage,
  type ConversationThread,
} from '@bluberi/api-client';
import { userApiClient } from '@bluberi/web-auth/user-api-client';
import { cache } from 'react';

import { authConfig } from '../auth/config';
import { getUser } from '../auth/current-user';
import { getRegistration } from '../registration/registration';

/** The longest subject and the longest message the API takes. */
export const subjectMaxLength = 120;
export const messageMaxLength = 2000;

/** The pages of the inbox, without the language in front. */
export const messagesPath = '/zpravy';
export const newMessagePath = `${messagesPath}/nova`;

export function conversationPath(conversationId: string): string {
  return `${messagesPath}/${conversationId}`;
}

/**
 * The seller the signed-in person works for: the one they registered, or the first one they are
 * staff of. Undefined for a person without a seller. Asked once per request.
 */
export const getWorkplaceId = cache(async (): Promise<string | undefined> => {
  const registration = await getRegistration();

  if (registration?.seller) {
    return registration.seller.id;
  }

  const user = await getUser();

  return user?.sellerMemberships[0]?.sellerId;
});

/**
 * A page of the inbox of the seller: the conversation written in last comes first.
 * Without a cursor it is the first page. Undefined when it cannot be read.
 */
export async function getInbox(cursor?: string): Promise<ConversationsPage | undefined> {
  const sellerId = await getWorkplaceId();
  const client = await userApiClient(authConfig());

  if (!sellerId || !client) {
    return undefined;
  }

  const { data } = await sellerInboxInbox({ client, path: { sellerId }, query: { cursor } });

  return data;
}

/**
 * One conversation with a page of its messages: the newest ones, or the ones before a cursor.
 * Null when the seller has no such conversation.
 */
export async function getConversation(
  conversationId: string,
  cursor?: string,
): Promise<ConversationThread | null | undefined> {
  const sellerId = await getWorkplaceId();
  const client = await userApiClient(authConfig());

  if (!sellerId || !client) {
    return undefined;
  }

  const { data, response } = await sellerInboxThread({
    client,
    path: { sellerId, conversationId },
    query: { cursor },
  });

  // An address typed by hand: not an id (400) or not a conversation of this seller (404).
  return response?.status === 404 || response?.status === 400 ? null : data;
}

/** How many messages of Bluberi the seller has not opened yet. Zero when it cannot be read. */
export const getUnreadCount = cache(async (): Promise<number> => {
  const sellerId = await getWorkplaceId();
  const client = await userApiClient(authConfig());

  if (!sellerId || !client) {
    return 0;
  }

  const { data } = await sellerInboxUnread({ client, path: { sellerId } });

  return data?.count ?? 0;
});
