import type { PlaySessionData } from "@bfbs/common-sdk";
import { renderHook, waitFor } from "@testing-library/react-native";

const mockReportError = jest.fn();

jest.mock("@/infra/error", () => ({
  reportError: (error: unknown, context: unknown) =>
    mockReportError(error, context),
}));

import { useLivePlaySessionLifecycle } from "@/features/video-player/hooks/use-player/use-live-play-session-lifecycle";

function createPlaySession(id: string): PlaySessionData {
  return {
    close: jest.fn(() => Promise.resolve()),
    id,
    startKeepAlive: jest.fn(),
    stopKeepAlive: jest.fn(),
  };
}

describe("useLivePlaySessionLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("starts keep-alive once while the live session remains active", () => {
    const playSession = createPlaySession("session-1");
    const { rerender } = renderHook<void, { isTerminal: boolean }>(
      ({ isTerminal }) =>
        useLivePlaySessionLifecycle({
          isTerminal,
          playSession,
          visible: true,
        }),
      { initialProps: { isTerminal: false } },
    );

    rerender({ isTerminal: false });

    expect(playSession.startKeepAlive).toHaveBeenCalledTimes(1);
    expect(playSession.close).not.toHaveBeenCalled();
  });

  test("stops keep-alive and closes once when the player is hidden", async () => {
    const playSession = createPlaySession("session-1");
    const { rerender, unmount } = renderHook<void, { visible: boolean }>(
      ({ visible }) =>
        useLivePlaySessionLifecycle({
          isTerminal: false,
          playSession,
          visible,
        }),
      { initialProps: { visible: true } },
    );

    rerender({ visible: false });
    unmount();

    await waitFor(() => {
      expect(playSession.stopKeepAlive).toHaveBeenCalledTimes(1);
      expect(playSession.close).toHaveBeenCalledTimes(1);
    });
  });

  test("releases a replaced session and maintains the replacement", async () => {
    const firstSession = createPlaySession("session-1");
    const secondSession = createPlaySession("session-2");
    const { rerender } = renderHook<void, { playSession: PlaySessionData }>(
      ({ playSession }) =>
        useLivePlaySessionLifecycle({
          isTerminal: false,
          playSession,
          visible: true,
        }),
      { initialProps: { playSession: firstSession } },
    );

    rerender({ playSession: secondSession });

    await waitFor(() => {
      expect(firstSession.close).toHaveBeenCalledTimes(1);
      expect(secondSession.startKeepAlive).toHaveBeenCalledTimes(1);
    });
  });

  test("releases the session once after a terminal player state", async () => {
    const playSession = createPlaySession("session-1");
    const { rerender, unmount } = renderHook<void, { isTerminal: boolean }>(
      ({ isTerminal }) =>
        useLivePlaySessionLifecycle({
          isTerminal,
          playSession,
          visible: true,
        }),
      { initialProps: { isTerminal: false } },
    );

    rerender({ isTerminal: true });
    unmount();

    await waitFor(() => {
      expect(playSession.stopKeepAlive).toHaveBeenCalledTimes(1);
      expect(playSession.close).toHaveBeenCalledTimes(1);
    });
  });

  test("reports a close failure without retrying the released session", async () => {
    const error = new Error("Session close failed");
    const playSession = createPlaySession("session-1");
    jest.mocked(playSession.close).mockRejectedValueOnce(error);
    const { rerender } = renderHook<void, { visible: boolean }>(
      ({ visible }) =>
        useLivePlaySessionLifecycle({
          isTerminal: false,
          playSession,
          visible,
        }),
      { initialProps: { visible: true } },
    );

    rerender({ visible: false });
    rerender({ visible: true });

    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(error, {
        tags: { area: "playback", operation: "close_live_session" },
      });
    });
    expect(playSession.close).toHaveBeenCalledTimes(1);
    expect(playSession.startKeepAlive).toHaveBeenCalledTimes(1);
  });
});
