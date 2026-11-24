'use server';

import {
  sellerModerationApprove,
  sellerModerationReject,
  sellerModerationRemoveDraft,
  sellerModerationReopen,
  sellerModerationRequestDocuments,
} from '@bluberi/api-client';
import type { Client } from '@bluberi/api-client/client';
import {
  done,
  failure,
  invalidInput,
  succeeded,
  type ActionResult,
} from '@bluberi/web-auth/action-result';
import { userApiClient } from '@bluberi/web-auth/user-api-client';
import { refresh } from 'next/cache';

import { authConfig } from '../auth/config';
import { decisionMessageOf } from './decision-message';
import { isId } from './ids';

// What comes from the browser is checked before it is used.

/** The same code the API answers with when nobody is signed in. */
const unauthenticated = { ok: false, code: 'UNAUTHENTICATED' } as const;

/**
 * Makes a decision about a seller as the signed-in person. After a decision that worked
 * the card is drawn again, so it shows the new status and the decision in the history.
 */
async function decide(
  run: (client: Client) => Promise<{ readonly data?: unknown; readonly error?: unknown }>,
): Promise<ActionResult> {
  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const { data, error } = await run(client);

  if (!data) {
    return failure(error);
  }

  refresh();

  return done;
}

/** Lets a seller in the check sell. */
export async function approveSeller(sellerId: unknown): Promise<ActionResult> {
  if (!isId(sellerId)) {
    return invalidInput;
  }

  return decide((client) => sellerModerationApprove({ client, path: { sellerId } }));
}

/** Asks a seller in the check for documents. The message says which ones. */
export async function requestSellerDocuments(
  sellerId: unknown,
  message: unknown,
): Promise<ActionResult> {
  const text = decisionMessageOf(message);

  if (!isId(sellerId) || text === undefined) {
    return invalidInput;
  }

  return decide((client) =>
    sellerModerationRequestDocuments({ client, path: { sellerId }, body: { message: text } }),
  );
}

/** Refuses a seller. The message says why. */
export async function rejectSeller(sellerId: unknown, message: unknown): Promise<ActionResult> {
  const text = decisionMessageOf(message);

  if (!isId(sellerId) || text === undefined) {
    return invalidInput;
  }

  return decide((client) =>
    sellerModerationReject({ client, path: { sellerId }, body: { message: text } }),
  );
}

/** Takes a refused seller back into the check. */
export async function reopenSeller(sellerId: unknown): Promise<ActionResult> {
  if (!isId(sellerId)) {
    return invalidInput;
  }

  return decide((client) => sellerModerationReopen({ client, path: { sellerId } }));
}

/**
 * Deletes a registration nobody sent. Its card is not drawn again: there is nothing
 * left to show, so the page goes back to the list.
 */
export async function removeSellerDraft(sellerId: unknown): Promise<ActionResult> {
  if (!isId(sellerId)) {
    return invalidInput;
  }

  const client = await userApiClient(authConfig());

  if (!client) {
    return unauthenticated;
  }

  const result = await sellerModerationRemoveDraft({ client, path: { sellerId } });

  return succeeded(result) ? done : failure(result.error);
}
