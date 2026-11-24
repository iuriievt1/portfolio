import { useEffect, useState } from "react";

const TICK_MS = 1000;

/** Returns the current epoch time, ticking only while the caller is active. */
export function useCurrentTime(active: boolean, tickMs = TICK_MS) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    const tick = () => setNowMs(Date.now());

    tick();

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(
      () => {
        tick();
        intervalId = setInterval(tick, tickMs);
      },
      tickMs - (Date.now() % tickMs),
    );

    return () => {
      clearTimeout(timeoutId);

      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }
    };
  }, [active, tickMs]);

  return nowMs;
}
