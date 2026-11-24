import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

const mockPutLastPlayPosition = jest.fn();
const mockReportError = jest.fn();
const mockRequestSignIn = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  PlaySession: {
    putLastPlayPosition: (input: unknown) => mockPutLastPlayPosition(input),
  },
}));

jest.mock("@/features/auth/sign-in-request-store", () => ({
  requestSignIn: () => mockRequestSignIn(),
}));

jest.mock("@/infra/error", () => ({
  reportError: (error: unknown) => mockReportError(error),
}));

import { PlaybackSourceType, SynamediaGoApiError } from "@bfbs/common-sdk";
import { usePlaySessionPersistence } from "@/features/video-player/hooks/use-player/use-play-session-persistence";
import type { VodVideoSource } from "@/features/video-player/types";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const source: VodVideoSource = {
  playSession: {
    assetId: "asset-1",
    close: jest.fn(() => Promise.resolve()),
    id: "session-1",
    manifestUrl: "https://example.com/vod.m3u8",
    startKeepAlive: jest.fn(),
    stopKeepAlive: jest.fn(),
  },
  sourceType: PlaybackSourceType.HLS,
  title: "VOD",
  url: "https://example.com/vod.m3u8",
};

describe("usePlaySessionPersistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns terminal position-write expiry to sign-in", async () => {
    mockPutLastPlayPosition.mockRejectedValue(
      new SynamediaGoApiError({
        code: "AUTH_006",
        status: 401,
        statusText: "Unauthorized",
      }),
    );
    const playheadSecondsRef = { current: 42 };
    const { unmount } = renderHook(
      () =>
        usePlaySessionPersistence({
          playheadSecondsRef,
          source,
          visible: true,
        }),
      { wrapper: createWrapper() },
    );

    unmount();

    await waitFor(() => {
      expect(mockRequestSignIn).toHaveBeenCalledTimes(1);
    });
    expect(mockReportError).not.toHaveBeenCalled();
  });

  test("reports a temporary position-write failure without signing out", async () => {
    const error = new TypeError("Network request failed");
    mockPutLastPlayPosition.mockRejectedValue(error);
    const playheadSecondsRef = { current: 42 };
    const { unmount } = renderHook(
      () =>
        usePlaySessionPersistence({
          playheadSecondsRef,
          source,
          visible: true,
        }),
      { wrapper: createWrapper() },
    );

    unmount();

    await waitFor(() => {
      expect(mockReportError).toHaveBeenCalledWith(error);
    });
    expect(mockRequestSignIn).not.toHaveBeenCalled();
  });
});
