'use client';

import { useEffect, useRef } from 'react';

interface RunWhenShownProps {
  /** A server action that needs no answer, for example "the person has read this". */
  readonly action: () => Promise<unknown>;
}

/**
 * Runs an action once the page is really on the screen of a person. A page that is only
 * prepared ahead, built on the server, or open in a tab nobody looks at does not run it:
 * there it waits until the tab is looked at. It draws nothing.
 *
 * It runs once for its life. Give it a key to run it again, for example for a newer message.
 */
export function RunWhenShown({ action }: RunWhenShownProps) {
  const ran = useRef(false);

  useEffect(() => {
    const run = (): void => {
      // Once, however often the page is drawn again.
      if (!ran.current && document.visibilityState === 'visible') {
        ran.current = true;
        void action();
      }
    };

    document.addEventListener('visibilitychange', run);
    run();

    return () => {
      document.removeEventListener('visibilitychange', run);
    };
  }, [action]);

  return null;
}
