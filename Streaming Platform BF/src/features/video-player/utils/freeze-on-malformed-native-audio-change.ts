import { reportError } from "@/infra/error";

// TODO: Remove this workaround when common-sdk handles missing native audio
// tracks and stops terminal live-window recovery loops.

type NativeAudioChangedEvent = {
  newAudioTrack?: unknown;
};

type NativeViewProps = Record<string, unknown> & {
  onAudioChanged?: (event?: NativeAudioChangedEvent | null) => void;
};

type NativePlayerAdapter = {
  bitmovinPlayer?: {
    unload?: () => unknown;
  };
  toViewProps?: (props: unknown) => NativeViewProps;
};

/** Unloads native playback when Bitmovin loses its audio track while recovering. */
export function freezeOnMalformedNativeAudioChange(player: unknown): void {
  const adapter = player as NativePlayerAdapter;
  const toViewProps = adapter.toViewProps;
  let hasFrozenPlayback = false;

  if (typeof toViewProps !== "function") {
    return;
  }

  adapter.toViewProps = (props) => {
    const viewProps = toViewProps.call(adapter, props);
    const onAudioChanged = viewProps.onAudioChanged;

    if (typeof onAudioChanged !== "function") {
      return viewProps;
    }

    return {
      ...viewProps,
      onAudioChanged: (event) => {
        if (!event?.newAudioTrack) {
          const unload = adapter.bitmovinPlayer?.unload;

          if (!hasFrozenPlayback && typeof unload === "function") {
            hasFrozenPlayback = true;
            reportError(
              new Error(
                "Playback unloaded after a malformed native audio-change event",
              ),
              {
                tags: {
                  area: "playback",
                  operation: "malformed_audio_change",
                },
              },
            );
            void new Promise((resolve) => {
              resolve(unload.call(adapter.bitmovinPlayer));
            }).catch(reportError);
          }
          return;
        }

        onAudioChanged(event);
      },
    };
  };
}
