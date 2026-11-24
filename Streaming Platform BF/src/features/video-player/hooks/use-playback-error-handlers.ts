import type { PlayerError, PlaySessionData } from "@bfbs/common-sdk";
import { PlaybackPlayerState } from "@bfbs/common-sdk";
import type { Dispatch, SetStateAction } from "react";
import type { PlaybackError } from "@/features/video-player/hooks/use-bitmovin-instance";
import { reportPlaybackError } from "@/features/video-player/utils/report-playback-error";

export function usePlaybackErrorHandlers(
  setError: Dispatch<SetStateAction<PlaybackError | null>>,
  setPlayerState: Dispatch<SetStateAction<PlaybackPlayerState>>,
  playSession?: PlaySessionData | undefined,
) {
  const handlePlayerError = (playerError: PlayerError) => {
    reportPlaybackError(playerError, {
      playSession,
      playerPlaybackError: playerError,
    });
    setError({ cause: { playerPlaybackError: playerError }, kind: "playback" });
    setPlayerState(PlaybackPlayerState.ERROR);
  };

  const handleSourceError = (sourceError: unknown) => {
    reportPlaybackError(sourceError, {
      playSession,
      playSessionError: sourceError,
    });
    // Keep detail the SDK already sent to onError, e.g. Android 2305 as
    // PLAY_005, but replace a placeholder that carries none.
    setError((current) =>
      current?.cause
        ? current
        : { cause: { playSessionError: sourceError }, kind: "load" },
    );
    setPlayerState(PlaybackPlayerState.ERROR);
  };

  return { handlePlayerError, handleSourceError };
}
