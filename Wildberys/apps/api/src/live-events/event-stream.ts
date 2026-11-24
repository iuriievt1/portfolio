import type { MessageEvent } from '@nestjs/common';
import {
  concat,
  filter,
  ignoreElements,
  interval,
  map,
  merge,
  of,
  takeUntil,
  timer,
  type Observable,
} from 'rxjs';

import type { Change, LiveEvent } from './live-events.js';

/** A stream that has nothing to say sends a line this often, so nothing on the way closes it as idle. */
export const heartbeatMilliseconds = 25_000;

/** How long a browser waits before it opens a stream again after one ended. */
const reconnectMilliseconds = 1_000;

/** From here on the page hears every change. What changed before is on the page only after it is read again. */
const ready: MessageEvent = { type: 'ready', retry: reconnectMilliseconds, data: {} };

/**
 * The stream an open page listens to. It says "ready" when the page is heard, and "change" for
 * every change that concerns the person, with what changed. When changes may have been missed,
 * it says "ready" again.
 *
 * The stream ends with the access token it was opened with. The browser then opens a new one,
 * and who the person is and what they may hear is checked again.
 */
export function eventStream(
  events: Observable<LiveEvent>,
  concerns: (change: Change) => boolean,
  until: Date,
): Observable<MessageEvent> {
  const heard = events.pipe(
    filter((event) => event.kind === 'events-missed' || concerns(event)),
    map((event): MessageEvent =>
      event.kind === 'events-missed' ? ready : { type: 'change', data: event },
    ),
  );
  const heartbeat = interval(heartbeatMilliseconds).pipe(
    map((): MessageEvent => ({ comment: 'open' })),
  );
  /** Fires when the API stops and the events end. */
  const stopped = concat(events.pipe(ignoreElements()), of(true));

  return merge(of(ready), heard, heartbeat).pipe(takeUntil(timer(until)), takeUntil(stopped));
}
