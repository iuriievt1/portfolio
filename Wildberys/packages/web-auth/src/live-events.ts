import { cookies } from 'next/headers';

import { createApiClient } from './api-client';
import type { WebAuthConfig } from './config';
import { readSession } from './session-cookies';

/** A stream of live events of the API: its address as the generated client knows it, with what the address needs. */
export interface LiveEventStream {
  readonly url: string;
  readonly path?: Readonly<Record<string, string>>;
}

/**
 * An event has to reach the page the moment it is sent, so neither the browser
 * nor anything between keeps the stream, squeezes it or waits for more of it.
 */
const streamHeaders = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-store, no-transform',
  'x-accel-buffering': 'no',
};

/** An answer without a stream, with the status that says why. */
function refused(status: number): Response {
  return new Response(null, { status, headers: { 'cache-control': 'no-store' } });
}

/**
 * Passes a stream of live events of the API on to the browser of the signed-in person, as it is.
 * A browser never talks to the API: the route handler of an app that calls this stands between them.
 *
 * `signal` is the signal of the request of the browser. When the page goes away, the stream to the API
 * is closed with it. When the API ends the stream, the browser opens a new one by itself.
 */
export async function relayLiveEvents(
  config: WebAuthConfig,
  stream: LiveEventStream,
  signal: AbortSignal,
): Promise<Response> {
  const { accessToken } = readSession(await cookies(), config);

  if (!accessToken) {
    return refused(401);
  }

  const address = createApiClient(config).buildUrl({ url: stream.url, path: stream.path });
  let answer: Response;

  try {
    answer = await fetch(address, {
      headers: { accept: 'text/event-stream', authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal,
    });
  } catch {
    // The API cannot be reached, or the page went away before it answered.
    return refused(502);
  }

  if (!answer.ok || !answer.body) {
    await answer.body?.cancel();

    // The status of the API: no access, no such seller. 502 for an answer that is not a stream.
    return refused(answer.ok ? 502 : answer.status);
  }

  return new Response(answer.body, { headers: streamHeaders });
}
