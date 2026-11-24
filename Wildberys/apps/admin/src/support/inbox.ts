import {
  teamInboxInbox,
  teamInboxThread,
  teamInboxUnread,
  type CurrentUser,
  type TeamConversationsPage,
  type TeamConversationThread,
} from '@bluberi/api-client';
import { userApiClient } from '@bluberi/web-auth/user-api-client';
import type { Route } from 'next';
import { cache } from 'react';

import { authConfig } from '../auth/config';

/** The longest subject and the longest message the API takes. */
export const subjectMaxLength = 120;
export const messageMaxLength = 2000;

/** The inbox of the team and the page of one conversation in it. */
export const inboxPath: Route = '/support';

export function conversationPath(conversationId: string): Route {
  return `/support/${conversationId}` as Route;
}

type Access = CurrentUser['platformAccess'];

/** The conversations with sellers belong to the support and to those who check sellers: either may read them. */
export function readsConversations(access: Access): boolean {
  return access.supportTickets !== 'none' || access.sellers !== 'none';
}

/** Full access to either section lets a person write to sellers. What they open counts as read. */
export function writesToSellers(access: Access): boolean {
  return access.supportTickets === 'full' || access.sellers === 'full';
}

// A reader answers undefined when the API did not answer with what was asked for.

/**
 * A page of the inbox of the team: the conversations with every seller, or with one.
 * Without a cursor it is the first page.
 */
export async function getTeamInbox(
  sellerId?: string,
  cursor?: string,
): Promise<TeamConversationsPage | undefined> {
  const client = await userApiClient(authConfig());

  if (!client) {
    return undefined;
  }

  const { data } = await teamInboxInbox({ client, query: { sellerId, cursor } });

  return data;
}

/**
 * One conversation with its seller and a page of its messages: the newest ones, or the ones
 * before a cursor. Null when there is no such conversation.
 */
export async function getTeamConversation(
  conversationId: string,
  cursor?: string,
): Promise<TeamConversationThread | null | undefined> {
  const client = await userApiClient(authConfig());

  if (!client) {
    return undefined;
  }

  const { data, response } = await teamInboxThread({
    client,
    path: { conversationId },
    query: { cursor },
  });

  // An address typed by hand: not an id (400) or not a conversation (404).
  return response?.status === 404 || response?.status === 400 ? null : data;
}

/** How many messages of sellers nobody of the team has opened yet. Zero when it cannot be read. */
export const getTeamUnreadCount = cache(async (): Promise<number> => {
  const client = await userApiClient(authConfig());

  if (!client) {
    return 0;
  }

  const { data } = await teamInboxUnread({ client });

  return data?.count ?? 0;
});
