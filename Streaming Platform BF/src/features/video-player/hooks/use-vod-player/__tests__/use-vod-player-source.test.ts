import {
  ClientMetadata,
  ContentCatalogue,
  type ContentItem,
  PlaySession,
  type PlaySessionData,
} from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { reportError } from "@/infra/error";
import { useVodPlayerSource } from "../use-vod-player-source";

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../../../../../__mocks__/common-sdk-enums"),
  ClientMetadata: {
    getFairplayServerCertificateUrl: jest.fn(),
  },
  ContentCatalogue: {
    getAsset: jest.fn(),
  },
  PlaySession: {
    createPlaySession: jest.fn(),
  },
}));

jest.mock("@/features/auth/auth-session-context", () => ({
  usePlaybackAuthorization: () => async () => true,
}));

jest.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  skipToken: Symbol("skipToken"),
  useQuery: jest.fn(),
}));

jest.mock("@/infra/error", () => ({
  reportError: jest.fn(),
}));

function mockQueryResult<TData>({
  data,
  error = null,
  isLoading = false,
  refetch = jest.fn(),
}: {
  data?: TData;
  error?: unknown;
  isLoading?: boolean;
  refetch?: jest.Mock;
}) {
  return {
    data,
    error,
    isLoading,
    refetch,
  } as unknown as ReturnType<typeof useQuery>;
}

function findQueryOptions(queryKeyName: string) {
  return jest.mocked(useQuery).mock.calls.find((call) => {
    const queryKey = (call[0] as { queryKey: readonly unknown[] }).queryKey;

    return queryKey[0] === queryKeyName;
  })?.[0] as unknown as {
    queryFn: (context?: { signal: AbortSignal }) => Promise<unknown>;
  };
}

describe("useVodPlayerSource", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("combines common SDK asset metadata with an asset PlaySession", async () => {
    const contentItem: ContentItem = {
      contentAdvisories: [{ label: "Strong language" }],
      durationSeconds: 120,
      episodeNumber: "2",
      episodeTitle: "The Test Episode",
      id: "asset-1",
      lastPlayPositionSeconds: 15,
      media: [
        {
          mimeType: "image/jpeg",
          type: "poster",
          url: "https://example.com/poster.jpg",
        },
      ],
      parentalRating: { label: "15", value: 15 },
      seasonNumber: "1",
      title: "Real asset",
    };
    const playSession: PlaySessionData = {
      close: jest.fn(() => Promise.resolve()),
      drmProperties: { blob: "token", laUrl: "https://example.com/license" },
      drmType: "wvDrm",
      id: "play-session-1",
      manifestUrl: "https://example.com/asset.m3u8",
      startKeepAlive: jest.fn(),
      stopKeepAlive: jest.fn(),
    };

    jest.mocked(ContentCatalogue.getAsset).mockResolvedValue(contentItem);
    jest.mocked(PlaySession.createPlaySession).mockResolvedValue(playSession);
    jest
      .mocked(ClientMetadata.getFairplayServerCertificateUrl)
      .mockResolvedValue("https://example.com/fairplay.cer");
    jest.mocked(useQuery).mockImplementation((options) => {
      const queryKey = (options as { queryKey: readonly unknown[] }).queryKey;

      if (queryKey[0] === "vodPlayerAsset") {
        return mockQueryResult({ data: contentItem });
      }

      if (queryKey[0] === "playSession") {
        return mockQueryResult({ data: playSession });
      }

      return mockQueryResult({ data: undefined });
    });

    const { result } = renderHook(() =>
      useVodPlayerSource({ id: "asset-1", title: "Fallback" }),
    );
    const assetQueryOptions = findQueryOptions("vodPlayerAsset");
    const playSessionQueryOptions = findQueryOptions("playSession");

    await assetQueryOptions.queryFn();
    await playSessionQueryOptions.queryFn({
      signal: new AbortController().signal,
    });

    expect(ContentCatalogue.getAsset).toHaveBeenCalledWith({
      assetId: "asset-1",
      shared: false,
    });
    expect(PlaySession.createPlaySession).toHaveBeenCalledWith({
      assetId: "asset-1",
    });
    expect(result.current).toEqual({
      error: null,
      isLoading: false,
      retry: expect.any(Function),
      source: expect.objectContaining({
        contentAdvisories: [{ label: "Strong language" }],
        durationSeconds: 120,
        episodeNumber: "2",
        episodeTitle: "The Test Episode",
        parentalRating: { label: "15", value: 15 },
        playSession,
        posterUrl: "https://example.com/poster.jpg",
        seasonNumber: "1",
        sourceType: "hls",
        startPositionSeconds: 15,
        title: "Real asset",
        url: "https://example.com/asset.m3u8",
      }),
    });
    expect(result.current.source?.drm).toEqual({
      widevine: {
        headers: { Authorization: "Bearer token" },
        licenseUrl: "https://example.com/license",
      },
    });
  });

  it("surfaces query errors and refetches asset and session data on retry", () => {
    const error = new Error("No source");
    // Retry checks each refetch result for a removed device.
    const refetchAsset = jest.fn().mockResolvedValue({ error: null });
    const refetchPlaySession = jest.fn().mockResolvedValue({ error: null });

    jest.mocked(useQuery).mockImplementation((options) => {
      const queryKey = (options as { queryKey: readonly unknown[] }).queryKey;

      if (queryKey[0] === "vodPlayerAsset") {
        return mockQueryResult({
          error,
          refetch: refetchAsset,
        });
      }

      if (queryKey[0] === "playSession") {
        return mockQueryResult({
          refetch: refetchPlaySession,
        });
      }

      return mockQueryResult({});
    });

    const { result } = renderHook(() =>
      useVodPlayerSource({ id: "asset-1", title: "Asset" }),
    );

    expect(result.current).toEqual({
      error,
      isLoading: false,
      retry: expect.any(Function),
      source: null,
    });
    expect(reportError).toHaveBeenCalledWith(error, {
      tags: { errorCode: "PLAY_001" },
    });

    act(() => {
      result.current.retry();
    });

    expect(refetchAsset).toHaveBeenCalledTimes(1);
    expect(refetchPlaySession).toHaveBeenCalledTimes(1);
  });
});
