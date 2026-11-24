import type { PlaySessionData } from "@bfbs/common-sdk";
import { useEffect, useRef } from "react";
import { reportError } from "@/infra/error";

type UseLivePlaySessionLifecycleParams = {
  isTerminal: boolean;
  playSession: PlaySessionData | null;
  visible: boolean;
};

/** Maintains and releases each provider session owned by the live player. */
export function useLivePlaySessionLifecycle({
  isTerminal,
  playSession,
  visible,
}: UseLivePlaySessionLifecycleParams) {
  const releasedSessionIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (
      !(visible && playSession?.id) ||
      isTerminal ||
      releasedSessionIdsRef.current.has(playSession.id)
    ) {
      return;
    }

    try {
      playSession.startKeepAlive();
    } catch (error) {
      reportError(error, {
        tags: { area: "playback", operation: "start_session_keep_alive" },
      });
    }

    return () => {
      try {
        playSession.stopKeepAlive();
      } catch (error) {
        reportError(error, {
          tags: { area: "playback", operation: "stop_session_keep_alive" },
        });
      }

      if (releasedSessionIdsRef.current.has(playSession.id)) {
        return;
      }

      releasedSessionIdsRef.current.add(playSession.id);
      const reportCloseError = (error: unknown) => {
        reportError(error, {
          tags: { area: "playback", operation: "close_live_session" },
        });
      };

      void playSession.close().catch(reportCloseError);
    };
  }, [isTerminal, playSession, visible]);
}
