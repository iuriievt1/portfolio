import { PlaySession } from "@bfbs/common-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef } from "react";
import { handleSessionExpiry } from "@/features/auth/utils/session-expiry";
import { CONTINUE_WATCHING_QUERY_KEY } from "@/features/continue-watching/use-continue-watching";
import { reportError } from "@/infra/error";
import type { VideoSource, VodVideoSource } from "../../types";
import { isLiveSource } from "../../utils/live-player";

type PersistableSource = {
  channelId?: string;
  isMockLivePlayer?: boolean;
  playSession?: VideoSource["playSession"];
};

type UsePlaySessionPersistenceParams = {
  playheadSecondsRef: RefObject<number | null>;
  source: VideoSource | VodVideoSource | null | undefined;
  visible: boolean;
};

export function usePlaySessionPersistence({
  playheadSecondsRef,
  source,
  visible,
}: UsePlaySessionPersistenceParams) {
  const queryClient = useQueryClient();
  const releasedPlaySessionIdsRef = useRef(new Set<string>());
  const persistable: PersistableSource | null = source ?? null;
  const sourcePlaySession =
    persistable?.isMockLivePlayer === true
      ? null
      : (persistable?.playSession ?? null);

  useEffect(() => {
    if (
      !(visible && sourcePlaySession?.id) ||
      isLiveSource(persistable) ||
      releasedPlaySessionIdsRef.current.has(sourcePlaySession.id)
    ) {
      return;
    }

    const playSession = sourcePlaySession;

    try {
      playSession.startKeepAlive();
    } catch (error) {
      reportError(error, {
        tags: { area: "playback", operation: "start_vod_session_keep_alive" },
      });
    }

    return () => {
      if (releasedPlaySessionIdsRef.current.has(playSession.id)) {
        return;
      }

      try {
        playSession.stopKeepAlive();
      } catch (error) {
        reportError(error, {
          tags: { area: "playback", operation: "stop_vod_session_keep_alive" },
        });
      }

      const { assetId } = playSession;

      releasedPlaySessionIdsRef.current.add(playSession.id);

      const positionSeconds = Math.max(playheadSecondsRef.current ?? 0, 0);

      if (assetId) {
        void PlaySession.putLastPlayPosition({ assetId, positionSeconds })
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: ["asset"] });
            void queryClient.invalidateQueries({ queryKey: ["appContent"] });
            void queryClient.invalidateQueries({
              queryKey: CONTINUE_WATCHING_QUERY_KEY,
            });
          })
          .catch((error: unknown) => {
            if (!handleSessionExpiry(error)) {
              reportError(error);
            }
          });
      }

      void playSession
        .close()
        .then(() => {
          queryClient.removeQueries({ queryKey: ["playSession"] });
        })
        .catch((error: unknown) => {
          reportError(error, {
            tags: { area: "playback", operation: "close_vod_session" },
          });
        });
    };
  }, [
    persistable,
    playheadSecondsRef,
    queryClient,
    sourcePlaySession,
    visible,
  ]);
}
