import { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { filter, firstValueFrom, timeout } from 'rxjs';

import type { AuthTokens } from '../../src/auth/auth.dto.js';
import { LiveEvents } from '../../src/live-events/live-events.js';
import type { TestApp } from './test-app.js';

const probe = '00000000-0000-7000-8000-000000000000';

/**
 * Waits until the application hears the live events it reports. It subscribes to the channel
 * of Redis a moment after it starts, and a test that reports earlier would be heard by nobody.
 */
export async function liveEventsHeard(testApp: TestApp): Promise<void> {
  const live = testApp.app.get(LiveEvents);
  const mine = (event: { kind: string; sellerId?: string }): boolean => event.sellerId === probe;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const heard = firstValueFrom(live.events.pipe(filter(mine), timeout(100))).then(
      () => true,
      () => false,
    );

    await live.report({ kind: 'conversation-changed', sellerId: probe, conversationId: probe });

    if (await heard) {
      return;
    }
  }

  throw new Error('The application does not hear its live events. Is Redis running?');
}

export interface StreamEvent {
  readonly type: string;
  readonly data: unknown;
}

/** A stream of events of the API, held open the way a page holds it. */
export interface OpenStream {
  readonly status: number;
  /** The next event with a name. The lines that only keep the stream open are skipped. */
  next(): Promise<StreamEvent>;
  close(): void;
}

/** How long a test waits for an event before it fails. */
const patienceMilliseconds = 5_000;

function toEvent(block: string): StreamEvent | undefined {
  const field = (name: string): string | undefined =>
    block
      .split('\n')
      .find((line) => line.startsWith(`${name}: `))
      ?.slice(name.length + 2);
  const type = field('event');
  const data = field('data');

  return type === undefined
    ? undefined
    : { type, data: data ? (JSON.parse(data) as unknown) : null };
}

/** Opens a stream of events as a signed-in person, or as nobody. */
export async function openStream(
  testApp: TestApp,
  path: string,
  tokens?: AuthTokens,
): Promise<OpenStream> {
  const server: unknown = testApp.app.getHttpServer();

  if (!(server instanceof Server)) {
    throw new Error('The test application has no HTTP server');
  }

  // A stream needs a real connection, so the server takes a free port. Other tests are not in its way.
  if (!server.listening) {
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
  }

  const { port } = server.address() as AddressInfo;
  const hangUp = new AbortController();
  const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, {
    headers: tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {},
    signal: hangUp.signal,
  });
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let unread = '';

  async function next(): Promise<StreamEvent> {
    for (;;) {
      const end = unread.indexOf('\n\n');

      if (end >= 0) {
        const event = toEvent(unread.slice(0, end));

        unread = unread.slice(end + 2);

        if (event) {
          return event;
        }

        continue;
      }

      const chunk = await reader?.read();

      if (!chunk || chunk.done) {
        throw new Error('The stream ended');
      }

      unread += decoder.decode(chunk.value, { stream: true });
    }
  }

  return {
    status: response.status,
    next: () =>
      Promise.race([
        next(),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error(`No event came in ${String(patienceMilliseconds)} ms`));
          }, patienceMilliseconds).unref();
        }),
      ]),
    close: () => {
      hangUp.abort();
    },
  };
}
