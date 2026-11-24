import { useEffect, useState } from "react";

export const PROGRESS_TICK_MS = 1000;

export function getProgressFraction({
  endMs,
  nowMs,
  startMs,
}: {
  endMs: number;
  nowMs: number;
  startMs: number;
}) {
  if (endMs <= startMs) {
    return 0;
  }

  return Math.min(Math.max((nowMs - startMs) / (endMs - startMs), 0), 1);
}

/** Ticks here, not in the rail, so a tick repaints one bar not the list. */
export function useProgrammeProgress({
  endMs,
  startMs,
}: {
  endMs: number | undefined;
  startMs: number | undefined;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Window in the deps so the bar resyncs when a programme rolls over.
  useEffect(() => {
    if (startMs === undefined || endMs === undefined) {
      return;
    }

    setNowMs(Date.now());

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, PROGRESS_TICK_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [endMs, startMs]);

  if (startMs === undefined || endMs === undefined) {
    return undefined;
  }

  return getProgressFraction({ endMs, nowMs, startMs });
}
