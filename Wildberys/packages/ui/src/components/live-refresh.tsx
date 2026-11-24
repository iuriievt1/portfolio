'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Changes that come one right after another are shown with one reading of the page. */
const gatherMilliseconds = 100;

/** How long to wait before a stream that was refused is asked for again: first, and at most. */
const firstRetryMilliseconds = 2_000;
const longestRetryMilliseconds = 60_000;

interface LiveRefreshProps {
  /** The address of this app that passes on the live events of the API. */
  readonly url: string;
}

/**
 * Keeps an open page up to date without a reload. It listens to the live events of the API and,
 * when something changed, has the page read itself again: lists, numbers and the open conversation
 * are drawn anew, and what a person typed stays.
 *
 * The page listens only while it is on the screen. A page that comes back to the screen
 * listens again and reads itself once, so it shows what happened meanwhile. It draws nothing.
 */
export function LiveRefresh({ url }: LiveRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let stream: EventSource | undefined;
    let reading: ReturnType<typeof setTimeout> | undefined;
    let retrying: ReturnType<typeof setTimeout> | undefined;
    let retryIn = firstRetryMilliseconds;

    const readAgain = (): void => {
      clearTimeout(reading);
      reading = setTimeout(() => {
        router.refresh();
      }, gatherMilliseconds);
    };

    const listen = (): void => {
      if (stream || document.visibilityState !== 'visible') {
        return;
      }

      const opened = new EventSource(url);

      stream = opened;
      // "ready": the page is heard from now on. What changed before it was heard is read now.
      opened.addEventListener('ready', () => {
        retryIn = firstRetryMilliseconds;
        readAgain();
      });
      opened.addEventListener('change', readAgain);
      opened.addEventListener('error', () => {
        // After a stream that ended the browser comes back by itself. A stream that was refused
        // stays closed: it is asked for again here, less and less often.
        if (opened.readyState === EventSource.CLOSED && stream === opened) {
          stream = undefined;
          retrying = setTimeout(listen, retryIn);
          retryIn = Math.min(retryIn * 2, longestRetryMilliseconds);
        }
      });
    };

    const stop = (): void => {
      clearTimeout(retrying);
      stream?.close();
      stream = undefined;
    };

    const followScreen = (): void => {
      if (document.visibilityState === 'visible') {
        listen();
      } else {
        stop();
      }
    };

    document.addEventListener('visibilitychange', followScreen);
    listen();

    return () => {
      document.removeEventListener('visibilitychange', followScreen);
      clearTimeout(reading);
      stop();
    };
  }, [router, url]);

  return null;
}
