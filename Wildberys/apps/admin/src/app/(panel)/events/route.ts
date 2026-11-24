import type { TeamLiveStreamChangesData } from '@bluberi/api-client';
import { relayLiveEvents } from '@bluberi/web-auth/live-events';
import { connection } from 'next/server';

import { authConfig } from '../../../auth/config';

/**
 * What the open pages of the admin listen to: something changed in a section the person may open.
 * The admin asks the API for the stream as the signed-in person and passes it on,
 * so the browser never talks to the API.
 */
export async function GET(request: Request): Promise<Response> {
  // Runs for a real request only, never when the app is built.
  await connection();

  const stream = {
    url: '/v1/admin/events',
  } satisfies Pick<TeamLiveStreamChangesData, 'url'>;

  return relayLiveEvents(authConfig(), stream, request.signal);
}
