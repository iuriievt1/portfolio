import type { PlayerError, PlayerInstance } from "@bfbs/common-sdk";
import { Player } from "@bfbs/common-sdk/playback/bitmovin/native";
import { type ReactElement, useEffect, useState } from "react";
import { freezeOnMalformedNativeAudioChange } from "@/features/video-player/utils/freeze-on-malformed-native-audio-change";
import { reportError } from "@/infra/error";

export type PlaybackErrorKind = "init" | "load" | "playback";
export type PlaybackErrorCause = {
  playSessionError?: unknown;
  playerPlaybackError?: PlayerError | null;
};
export type PlaybackError = {
  cause?: PlaybackErrorCause;
  kind: PlaybackErrorKind;
};

export function useBitmovinInstance() {
  const [instance, setInstance] = useState<PlayerInstance<ReactElement> | null>(
    null,
  );
  const [initError, setInitError] = useState<PlaybackError | null>(null);

  useEffect(() => {
    let player: PlayerInstance<ReactElement> | null = null;

    const analyticsKey = process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_ANALYTICS_KEY;
    const licenseKey = process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY;
    const resolvedAnalyticsKey = analyticsKey ?? "";

    if (!licenseKey) {
      setInitError({ kind: "init" });
      return;
    }

    try {
      player = Player.createPlayer({
        analytics: {
          licenseKey: resolvedAnalyticsKey,
        },
        key: licenseKey,
        playerConfig: {
          playbackConfig: { isAutoplayEnabled: true },
          remoteControlConfig: { isCastEnabled: false },
          styleConfig: { isUiEnabled: false },
        },
      });
      // TODO: Remove this integration when common-sdk handles missing native
      // audio tracks and stops terminal live-window recovery loops.
      freezeOnMalformedNativeAudioChange(player.player);

      setInstance(player);
    } catch (err) {
      reportError(err);
      setInitError({ kind: "init" });
    }

    return () => {
      const activeInstance = player;
      player = null;

      if (!activeInstance) {
        return;
      }

      const activePlayer =
        activeInstance.player as typeof activeInstance.player & {
          destroy?: () => unknown;
          unload?: () => unknown;
        };

      void Promise.resolve(activePlayer.pause()).catch(reportError);

      if (typeof activePlayer.unload === "function") {
        void Promise.resolve(activePlayer.unload()).catch(reportError);
      }

      if (typeof activePlayer.destroy === "function") {
        void Promise.resolve(activePlayer.destroy()).catch(reportError);
      }
    };
  }, []);

  return { initError, instance };
}
