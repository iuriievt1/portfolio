import { freezeOnMalformedNativeAudioChange } from "@/features/video-player/utils/freeze-on-malformed-native-audio-change";
import { reportError } from "@/infra/error";

jest.mock("@/infra/error", () => ({
  reportError: jest.fn(),
}));

describe("freezeOnMalformedNativeAudioChange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("unloads once when audio-change events have no new track", () => {
    const onAudioChanged = jest.fn();
    const unload = jest.fn();
    const adapter = {
      bitmovinPlayer: { unload },
      toViewProps: () => ({ onAudioChanged }),
    };

    freezeOnMalformedNativeAudioChange(adapter);

    const viewProps = adapter.toViewProps();
    viewProps.onAudioChanged(null);
    viewProps.onAudioChanged(undefined);
    viewProps.onAudioChanged({});

    expect(unload).toHaveBeenCalledTimes(1);
    expect(onAudioChanged).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Playback unloaded after a malformed native audio-change event",
      }),
      {
        tags: {
          area: "playback",
          operation: "malformed_audio_change",
        },
      },
    );
  });

  test("forwards complete audio-change events", () => {
    const onAudioChanged = jest.fn();
    const unload = jest.fn();
    const adapter = {
      bitmovinPlayer: { unload },
      toViewProps: () => ({ onAudioChanged }),
    };
    const event = { newAudioTrack: { identifier: "audio-1" } };

    freezeOnMalformedNativeAudioChange(adapter);

    const viewProps = adapter.toViewProps();
    viewProps.onAudioChanged(event);

    expect(onAudioChanged).toHaveBeenCalledWith(event);
    expect(unload).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  test("reports a synchronous unload failure without throwing", async () => {
    const unloadError = new Error("unload failed");
    const adapter = {
      bitmovinPlayer: {
        unload: jest.fn(() => {
          throw unloadError;
        }),
      },
      toViewProps: () => ({ onAudioChanged: jest.fn() }),
    };

    freezeOnMalformedNativeAudioChange(adapter);

    expect(() => adapter.toViewProps().onAudioChanged({})).not.toThrow();
    await Promise.resolve();
    expect(reportError).toHaveBeenCalledWith(unloadError);
  });
});
