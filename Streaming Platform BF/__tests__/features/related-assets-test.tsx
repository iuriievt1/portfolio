import type { ContentItem } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

const mockGetRelatedRecommendations = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ContentCatalogue: {
    getRelatedRecommendations: mockGetRelatedRecommendations,
  },
}));

const {
  hasRelatedContent,
  RELATED_ASSETS_LIMIT,
  selectRelatedAssets,
} = require("@/features/watch-details/related-content");
const {
  useRelatedAssets,
} = require("@/features/watch-details/hooks/use-related-assets");

const vodAsset = { contentType: "standalone", id: "asset-1", title: "Venom" };
const liveAsset = { contentType: "channel", id: "channel-1", title: "BFBS" };

function buildVodItems(count: number): ContentItem[] {
  return Array.from({ length: count }, (_, index) => ({
    contentType: "standalone",
    id: `related-${index}`,
    title: `Related ${index}`,
  })) as ContentItem[];
}

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("related assets", () => {
  beforeEach(() => {
    mockGetRelatedRecommendations.mockReset();
  });

  test("offers related content for VOD assets only", () => {
    expect(hasRelatedContent(vodAsset)).toBe(true);
    expect(hasRelatedContent(liveAsset)).toBe(false);
    expect(
      hasRelatedContent({
        contentType: "standalone",
        externalViewingOptions: { externalOnly: true },
        id: "external-1",
        title: "Elsewhere",
      }),
    ).toBe(false);
  });

  test("caps the grid at the designed number of tiles", () => {
    expect(RELATED_ASSETS_LIMIT).toBe(30);
    expect(selectRelatedAssets(buildVodItems(45))).toHaveLength(30);
    expect(selectRelatedAssets(buildVodItems(7))).toHaveLength(7);
  });

  test("drops what the grid cannot open", () => {
    const items = [
      { contentType: "standalone", id: "vod-1", title: "Playable" },
      { contentType: "channel", id: "channel-1", title: "A channel" },
      {
        contentType: "standalone",
        externalViewingOptions: { externalOnly: true },
        id: "external-1",
        title: "External only",
      },
      { contentType: "show", id: "show-1", title: "A show" },
    ] as ContentItem[];

    expect(
      selectRelatedAssets(items).map((item: ContentItem) => item.id),
    ).toEqual(["vod-1"]);
    expect(selectRelatedAssets(undefined)).toEqual([]);
    expect(selectRelatedAssets([])).toEqual([]);
  });

  test("a show's page also keeps shows, seasons and VOD episodes, in order, each once", () => {
    const items = [
      { contentType: "show", id: "show-2", title: "A show" },
      { contentType: "standalone", id: "vod-1", title: "A film" },
      { contentType: "channel", id: "channel-1", title: "A channel" },
      {
        channelId: "channel-1",
        contentType: "episode",
        id: "live-episode-1",
        showId: "show-3",
        title: "On a channel",
      },
      { contentType: "season", id: "season-1", showId: "show-4", title: "S1" },
      {
        contentType: "episode",
        id: "episode-1",
        showId: "show-5",
        title: "E1",
      },
      { contentType: "standalone", id: "vod-1", title: "A film again" },
    ] as ContentItem[];

    expect(
      selectRelatedAssets(items, { includeSeries: true }).map(
        (item: ContentItem) => item.id,
      ),
    ).toEqual(["show-2", "vod-1", "season-1", "episode-1"]);
  });

  test("requests recommendations for the asset with the designed limit", async () => {
    mockGetRelatedRecommendations.mockResolvedValue(buildVodItems(3));

    const { result } = renderHook(() => useRelatedAssets(vodAsset), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    expect(mockGetRelatedRecommendations).toHaveBeenCalledWith({
      contentId: "asset-1",
      limit: 30,
    });
  });

  test("asks for a show's recommendations by its show id", async () => {
    mockGetRelatedRecommendations.mockResolvedValue(buildVodItems(2));
    const show = { contentType: "show", id: "show-1", title: "The Office" };

    const { result } = renderHook(() => useRelatedAssets(show, "show-1"), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(mockGetRelatedRecommendations).toHaveBeenCalledWith({
      limit: 30,
      showId: "show-1",
    });
  });

  test("never requests recommendations for a non-VOD asset", () => {
    const { result } = renderHook(() => useRelatedAssets(liveAsset), {
      wrapper: buildWrapper(),
    });

    expect(mockGetRelatedRecommendations).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  test("reports a failed request so the pane can say so", async () => {
    mockGetRelatedRecommendations.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useRelatedAssets(vodAsset), {
      wrapper: buildWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.items).toEqual([]);
  });
});
