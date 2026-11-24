import type { SellerLiveStreamChangesData } from '@bluberi/api-client';
import { relayLiveEvents } from '@bluberi/web-auth/live-events';
import { connection } from 'next/server';

import { authConfig } from '../../../auth/config';
import { getWorkplaceId } from '../../../messages/messages';

/**
 * What the open pages of a seller listen to: something about the seller changed, a message came,
 * the team decided. The portal asks the API for the stream as the signed-in person and passes it on,
 * so the browser never talks to the API.
 */
export async function GET(request: Request): Promise<Response> {
  // Runs for a real request only, never when the app is built.
  await connection();

  const sellerId = await getWorkplaceId();

  if (!sellerId) {
    return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  }

  const stream = {
    url: '/v1/sellers/{sellerId}/events',
    path: { sellerId },
  } satisfies Pick<SellerLiveStreamChangesData, 'url' | 'path'>;

  return relayLiveEvents(authConfig(), stream, request.signal);
}
