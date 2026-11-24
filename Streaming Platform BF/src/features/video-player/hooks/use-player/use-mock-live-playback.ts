import { PlaybackPlayerState } from "@bfbs/common-sdk";
import { useEffect, useRef, useState } from "react";

// Mock, remove later
function getMockLiveEdgeSeconds(captureStartTime: string | null) {
  const captureStartMs = Date.parse(captureStartTime ?? "");

  if (Number.isNaN(captureStartMs)) {
    return 0;
  }

  return Math.max((Date.now() - captureStartMs) / 1000, 0);
}

type UseMockLivePlaybackParams = {
  isMockLivePlayer: boolean;
  mockCaptureStartTime: string | null;
  mockStartPositionSeconds: number | null;
  playerState: PlaybackPlayerState;
  setPlayerState: (state: PlaybackPlayerState) => void;
  visible: boolean;
};

export function useMockLivePlayback({
  isMockLivePlayer,
  mockCaptureStartTime,
  mockStartPositionSeconds,
  playerState,
  setPlayerState,
  visible,
}: UseMockLivePlaybackParams) {
  const [mockPlayheadSeconds, setMockPlayheadSeconds] = useState<number | null>(
    null,
  );
  const mockPlayheadAnchorRef = useRef<{
    isPaused: boolean;
    seconds: number;
    wallMs: number;
  } | null>(null);
  const isMockPlaybackPaused =
    isMockLivePlayer && playerState === PlaybackPlayerState.PAUSED;

  const setMockPlayheadPosition = (seconds: number) => {
    const clampedSeconds = Math.max(seconds, 0);

    mockPlayheadAnchorRef.current = {
      isPaused: isMockPlaybackPaused,
      seconds: clampedSeconds,
      wallMs: Date.now(),
    };
    setMockPlayheadSeconds(clampedSeconds);
  };

  useEffect(() => {
    if (!(visible && isMockLivePlayer)) {
      mockPlayheadAnchorRef.current = null;
      setMockPlayheadSeconds(null);
      return;
    }

    if (playerState === PlaybackPlayerState.IDLE) {
      setPlayerState(PlaybackPlayerState.PLAYING);
    }

    const previousAnchor = mockPlayheadAnchorRef.current;
    let startSeconds =
      mockStartPositionSeconds ?? getMockLiveEdgeSeconds(mockCaptureStartTime);

    if (previousAnchor) {
      startSeconds = previousAnchor.isPaused
        ? previousAnchor.seconds
        : previousAnchor.seconds + (Date.now() - previousAnchor.wallMs) / 1000;
    }

    mockPlayheadAnchorRef.current = {
      isPaused: isMockPlaybackPaused,
      seconds: startSeconds,
      wallMs: Date.now(),
    };
    setMockPlayheadSeconds(startSeconds);

    if (isMockPlaybackPaused) {
      return;
    }

    const intervalId = setInterval(() => {
      const anchor = mockPlayheadAnchorRef.current;

      if (!anchor) {
        return;
      }

      setMockPlayheadSeconds(
        anchor.seconds + (Date.now() - anchor.wallMs) / 1000,
      );
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    isMockLivePlayer,
    mockCaptureStartTime,
    isMockPlaybackPaused,
    mockStartPositionSeconds,
    playerState,
    setPlayerState,
    visible,
  ]);

  return { mockPlayheadSeconds, setMockPlayheadPosition };
}
