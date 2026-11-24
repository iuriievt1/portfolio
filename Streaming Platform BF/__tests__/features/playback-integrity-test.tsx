import {
  CancelledError,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { AuthSessionContext } from "@/features/auth/auth-session-context";
import { useLivePlayerSource } from "@/features/video-player/hooks/use-live-player-source/use-live-player-source";
import { usePlaySession } from "@/features/video-player/hooks/use-play-session";
import { useVodPlayerSource } from "@/features/video-player/hooks/use-vod-player/use-vod-player-source";
import { preparePlayback } from "@/features/video-player/prepare-playback";
import { reportError } from "@/infra/error";

const mockAuthorize = jest.fn(async () => true);
const mockCreateSession = jest.fn();
const mockQueryError = jest.fn();
jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  ContentCatalogue: {
    getAsset: jest.fn(async () => ({ id: "asset-1", title: "Episode" })),
  },
  ClientMetadata: { getFairplayServerCertificateUrl: jest.fn() },
  PlaySession: {
    createPlaySession: (...args: unknown[]) => mockCreateSession(...args),
  },
}));
jest.mock("@/infra/error", () => ({ reportError: jest.fn() }));

let queryClient: QueryClient;
const session = {
  id: "session-1",
  manifestUrl: "https://example.com/live.m3u8",
  close: jest.fn(async () => {}),
};

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionContext
        value={{
          checkAuthenticatedDevice: mockAuthorize,
          signOut: async () => {},
        }}
      >
        {children}
      </AuthSessionContext>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthorize.mockReset().mockResolvedValue(true);
  mockCreateSession.mockReset().mockResolvedValue(session);
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
    queryCache: new QueryCache({ onError: mockQueryError }),
  });
});
afterEach(() => queryClient.clear());

test.each([
  { channelId: "channel-1" },
  { assetId: "asset-1" },
])("cancels a denied initial request for %o without a query error", async (input) => {
  mockAuthorize.mockResolvedValue(false);
  const { result } = renderHook(() => ({ ...usePlaySession(input) }), {
    wrapper,
  });
  await waitFor(() => expect(mockAuthorize).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
  expect(result.current.error).toBeNull();
  expect(result.current.isError).toBe(false);
  expect(mockCreateSession).not.toHaveBeenCalled();
  expect(mockQueryError).not.toHaveBeenCalled();
});

test.each([
  { channelId: "channel-1" },
  { assetId: "asset-1" },
])("authorizes direct player routes and retries for %o", async (input) => {
  const { result } = renderHook(() => ({ ...usePlaySession(input) }), {
    wrapper,
  });
  await waitFor(() => expect(result.current.data).toBe(session));
  expect(mockAuthorize).toHaveBeenCalledTimes(1);
  expect(mockCreateSession).toHaveBeenCalledWith(input);
  mockAuthorize.mockResolvedValueOnce(false);
  await act(async () => {
    await result.current.refetch();
  });
  expect(mockAuthorize).toHaveBeenCalledTimes(2);
  expect(mockCreateSession).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBeNull();
  expect(result.current.isError).toBe(false);
  expect(result.current.fetchStatus).toBe("idle");
  expect(mockQueryError).not.toHaveBeenCalled();
});

test("checks a channel switch before opening its session", async () => {
  const { result, rerender } = renderHook(
    ({ channelId }: { channelId: string }) => ({
      ...usePlaySession({ channelId }),
    }),
    { initialProps: { channelId: "channel-1" }, wrapper },
  );
  await waitFor(() => expect(result.current.data).toBe(session));
  mockAuthorize.mockResolvedValueOnce(false);
  rerender({ channelId: "channel-2" });
  await waitFor(() => expect(mockAuthorize).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
  expect(mockCreateSession).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBeNull();
  expect(result.current.isError).toBe(false);
});

test("denied live and VOD sources do not display or report a playback error", async () => {
  mockAuthorize.mockResolvedValue(false);
  const { result } = renderHook(
    () => ({
      live: useLivePlayerSource({ id: "channel-1", name: "BFBS" }),
      vod: useVodPlayerSource({ id: "asset-1", title: "Episode" }),
    }),
    { wrapper },
  );
  await waitFor(() => expect(mockAuthorize).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.live.isLoading).toBe(false));
  await waitFor(() => expect(result.current.vod.isLoading).toBe(false));
  expect(result.current.live.errorCode).toBeNull();
  expect(result.current.vod.error).toBeNull();
  expect(result.current.live.source).toBeNull();
  expect(result.current.vod.source).toBeNull();
  expect(reportError).not.toHaveBeenCalled();
});

test("real live and VOD session failures still display and report playback errors", async () => {
  const error = new Error("Session request failed");
  mockCreateSession.mockRejectedValue(error);
  const { result } = renderHook(
    () => ({
      live: useLivePlayerSource({ id: "channel-1", name: "BFBS" }),
      vod: useVodPlayerSource({ id: "asset-1", title: "Episode" }),
    }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.live.errorCode).toBe("PLAY_001"));
  await waitFor(() => expect(result.current.vod.error).toBe(error));
  expect(reportError).toHaveBeenCalledWith(error, {
    tags: { errorCode: "PLAY_001" },
  });
});

test.each([
  false,
  true,
])("denied preparation rejects even with a cached session: %s", async (cached) => {
  if (cached) {
    queryClient.setQueryData(
      ["playSession", { channelId: "channel-1" }],
      session,
    );
  }
  mockAuthorize.mockResolvedValue(false);
  await expect(
    preparePlayback(
      queryClient,
      { kind: "live", channelId: "channel-1" },
      mockAuthorize,
    ),
  ).rejects.toBeInstanceOf(CancelledError);
  expect(mockCreateSession).not.toHaveBeenCalled();
  expect(mockQueryError).not.toHaveBeenCalled();
  expect(reportError).not.toHaveBeenCalled();
});

test("does not open a session outside the authenticated gate", async () => {
  renderHook(() => usePlaySession({ channelId: "channel-1" }), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  await act(async () => {});
  expect(mockCreateSession).not.toHaveBeenCalled();
  expect(mockAuthorize).not.toHaveBeenCalled();
});
