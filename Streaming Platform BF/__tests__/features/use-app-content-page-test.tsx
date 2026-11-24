jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  usePlaybackAuthorization: () => async () => true,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AppContent } from "@/features/content-rails/app-content";
import { appQueryClient } from "@/infra/query/app-query-client";

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockUseLiveChannels = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (href: unknown) => mockPush(href) },
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  PlaySession: { createPlaySession: jest.fn() },
  ContentCatalogue: {
    getAsset: jest.fn(),
    getNavigation: jest.fn(),
  },
  ContentCategoryTemplate: {
    HERO: "HERO",
    SIXTEEN_BY_NINE_DESIGNED_LARGE: "SIXTEEN_BY_NINE_DESIGNED_LARGE",
    SIXTEEN_BY_NINE_DESIGNED_SMALL: "SIXTEEN_BY_NINE_DESIGNED_SMALL",
    SIXTEEN_BY_NINE_LARGE: "SIXTEEN_BY_NINE_LARGE",
    SIXTEEN_BY_NINE_STANDARD: "SIXTEEN_BY_NINE_STANDARD",
    SQUARE_LARGE: "SQUARE_LARGE",
    SQUARE_SMALL: "SQUARE_SMALL",
  },
}));

const mockCreatePlaySession = jest.requireMock("@bfbs/common-sdk").PlaySession
  .createPlaySession as jest.Mock;
const mockGetAsset = jest.requireMock("@bfbs/common-sdk").ContentCatalogue
  .getAsset as jest.Mock;

jest.mock("@/features/live-channels", () => ({
  useLiveChannels: () => mockUseLiveChannels(),
}));

jest.mock("@/features/content-rails/hooks/use-app-content-refresh", () => ({
  useAppContentRefresh: jest.fn(),
}));

jest.mock("@/features/top-navigation/components/top-navigation-header", () => ({
  TopNavigationHeader: () => null,
}));

import {
  createCategory,
  createItem,
  createRail,
} from "../../__fixtures__/content";

const { useAppContentPage } =
  require("@/features/content-rails/hooks/use-app-content-page") as typeof import("@/features/content-rails/hooks/use-app-content-page");
const { appContentQueryOptions } =
  require("@/features/content-rails/app-content") as typeof import("@/features/content-rails/app-content");

const vodRail = createRail({
  category: createCategory({ id: "vod-rail", name: "VOD" }),
  items: [createItem({ contentType: "standalone", id: "vod-1", title: "VOD" })],
});
const liveRail = createRail({
  category: createCategory({ id: "live-rail", name: "Live" }),
  items: [createItem({ contentType: "episode", id: "programme-1" })],
});
const continueWatchingRail = createRail({
  category: createCategory({ id: "Continue", name: "Continue Watching" }),
});

const appContent: AppContent = {
  navigation: {
    category: createCategory({ id: "root", name: "Root" }),
    children: [{ category: createCategory({ id: "Home", name: "Home" }) }],
  },
  sections: [
    {
      navigationItem: createCategory({ id: "Home", name: "Home" }),
      pageCategory: createCategory({ id: "home-page", name: "Home" }),
      rails: [vodRail, liveRail],
      route: "/",
    },
  ],
};

function renderPage(options?: Parameters<typeof useAppContentPage>[1]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  queryClient.setQueryData(appContentQueryOptions.queryKey, appContent);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useAppContentPage("/", options), { wrapper });
}

afterEach(() => {
  appQueryClient.clear();
});

describe("useAppContentPage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPush.mockClear();
    mockGetAsset.mockResolvedValue({ id: "asset", title: "Asset" });
    mockCreatePlaySession.mockResolvedValue({
      id: "session-1",
      manifestUrl: "https://example.com/stream.m3u8",
    });
    mockUseLiveChannels.mockReturnValue({
      channels: [
        {
          currentProgramme: { id: "programme-1", title: "Now" },
          id: "channel-1",
          name: "Channel One",
        },
      ],
      error: null,
      isLoading: false,
    });
  });

  it("renders channel-less episodes as on-demand content", () => {
    const { result } = renderPage();

    expect(result.current.rails.map((rail) => rail.kind).sort()).toEqual([
      "content",
      "content",
    ]);
  });

  it("opens the section's own View All route", () => {
    const { result } = renderPage();

    result.current.onViewAllPress(vodRail);

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { railId: vodRail.category.id, sectionRoute: "/" },
      pathname: "/view-all/[railId]",
    });
  });

  it("opens a category destination beneath Home using its provider id", () => {
    const { result } = renderPage();

    result.current.onContentTilePress(
      vodRail,
      createItem({
        categoryId: "provider-comedy",
        contentType: "category",
        id: "comedy",
        title: "Comedy",
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { categoryId: "provider-comedy" },
      pathname: "/genre/[categoryId]",
    });
  });

  it("lets a section route View All itself", () => {
    const onViewAllPress = jest.fn();
    const { result } = renderPage({ onViewAllPress });

    result.current.onViewAllPress(vodRail);

    expect(onViewAllPress).toHaveBeenCalledWith(vodRail);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("opens the watch details page for an on-demand item", () => {
    const { result } = renderPage();

    result.current.onContentTilePress(
      vodRail,
      createItem({ contentType: "standalone", id: "vod-1", title: "VOD One" }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { assetId: "vod-1" },
      pathname: "/watch/[assetId]",
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("lets a page route the watch details page itself", () => {
    const onVodAssetPress = jest.fn();
    const { result } = renderPage({ onVodAssetPress });
    const item = createItem({
      contentType: "standalone",
      id: "vod-1",
      title: "VOD One",
    });

    result.current.onContentTilePress(vodRail, item);

    expect(onVodAssetPress).toHaveBeenCalledWith(item);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("leaves an item that groups other items alone", () => {
    const onVodAssetPress = jest.fn();
    const { result } = renderPage({ onVodAssetPress });

    result.current.onContentTilePress(
      vodRail,
      createItem({ contentType: "group", id: "group-1", title: "Group One" }),
    );

    expect(onVodAssetPress).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("opens the series page for a show, even when it has a channel", () => {
    const { result } = renderPage();

    result.current.onContentTilePress(
      vodRail,
      createItem({
        channelId: "channel-1",
        contentType: "show",
        id: "show-1",
        title: "Show One",
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { showId: "show-1" },
      pathname: "/show/[showId]",
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("lets a page route the series page itself", () => {
    const onShowPress = jest.fn();
    const { result } = renderPage({ onShowPress });

    result.current.onContentTilePress(
      vodRail,
      createItem({ contentType: "show", id: "show-1", title: "Show One" }),
    );

    expect(onShowPress).toHaveBeenCalledWith("show-1");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("opens the series page for an on-demand episode", () => {
    const { result } = renderPage();

    result.current.onContentTilePress(
      vodRail,
      createItem({
        contentType: "episode",
        id: "episode-9",
        showId: "show-1",
        title: "Episode Nine",
      }),
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { showId: "show-1" },
      pathname: "/show/[showId]",
    });
  });

  it("plays a Continue Watching film straight away", async () => {
    const { result } = renderPage();

    result.current.onContentTilePress(
      continueWatchingRail,
      createItem({ contentType: "standalone", id: "vod-1", title: "Anna" }),
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        params: { id: "vod-1", title: "Anna" },
        pathname: "/player/vod/[id]",
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("plays a Continue Watching episode instead of opening its series", async () => {
    const { result } = renderPage();

    result.current.onContentTilePress(
      continueWatchingRail,
      createItem({
        contentType: "episode",
        id: "episode-9",
        showId: "show-1",
        title: "Episode Nine",
      }),
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        params: { id: "episode-9", title: "Episode Nine" },
        pathname: "/player/vod/[id]",
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("still plays a series episode live while it is airing", async () => {
    const { result } = renderPage();

    result.current.onContentTilePress(
      liveRail,
      createItem({
        contentType: "episode",
        id: "programme-1",
        showId: "show-1",
        title: "Now",
      }),
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        params: { channelId: "channel-1" },
        pathname: "/player/live/[channelId]",
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("opens the live player for a channel tile", async () => {
    const { result } = renderPage();

    result.current.onLiveTilePress({ id: "channel-1", name: "Channel One" });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        params: { channelId: "channel-1" },
        pathname: "/player/live/[channelId]",
      });
    });
  });

  it("keeps a channel in a mixed content rail on the channel route", () => {
    const onChannelPress = jest.fn();
    const { result } = renderPage({ onChannelPress });

    result.current.onContentTilePress(
      vodRail,
      createItem({
        contentType: "channel",
        id: "channel-1",
        title: "Channel One",
      }),
    );

    expect(onChannelPress).toHaveBeenCalledWith({
      id: "channel-1",
      name: "Channel One",
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
