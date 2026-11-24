jest.mock("@bfbs/common-sdk", () => ({
  PlaySession: {
    putLastPlayPosition: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/infra/error", () => ({ reportError: jest.fn() }));

import { PlaySession } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { usePlaySessionPersistence } from "../use-play-session-persistence";

const queryClients = new Set<QueryClient>();

type TestPlaySession = {
  assetId: string;
  close: jest.Mock<Promise<void>, []>;
  id: string;
  startKeepAlive: jest.Mock<void, []>;
  stopKeepAlive: jest.Mock<void, []>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClients.add(queryClient);

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("usePlaySessionPersistence", () => {
  afterEach(() => {
    for (const queryClient of queryClients) {
      queryClient.clear();
    }
    queryClients.clear();
  });

  it("keeps a VOD session alive and closes it when playback is dismissed", async () => {
    const playSession: TestPlaySession = {
      assetId: "asset-1",
      close: jest.fn(() => Promise.resolve()),
      id: "session-1",
      startKeepAlive: jest.fn(),
      stopKeepAlive: jest.fn(),
    };
    const playheadSecondsRef = { current: 42 };
    const source = {
      playSession,
      sourceType: "hls" as never,
      title: "Test asset",
      url: "https://example.com/test.m3u8",
    };

    const { rerender, unmount } = renderHook<void, { visible: boolean }>(
      ({ visible }) =>
        usePlaySessionPersistence({
          playheadSecondsRef,
          source,
          visible,
        }),
      { initialProps: { visible: true }, wrapper: createWrapper() },
    );

    expect(playSession.startKeepAlive).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ visible: false });
      await Promise.resolve();
    });

    expect(playSession.stopKeepAlive).toHaveBeenCalledTimes(1);
    expect(playSession.close).toHaveBeenCalledTimes(1);
    expect(PlaySession.putLastPlayPosition).toHaveBeenCalledWith({
      assetId: "asset-1",
      positionSeconds: 42,
    });

    unmount();
    expect(playSession.close).toHaveBeenCalledTimes(1);
  });
});
