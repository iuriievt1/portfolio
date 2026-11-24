jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  usePlaybackAuthorization: () => async () => true,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { appQueryClient } from "@/infra/query/app-query-client";

const SECTION_SLUG = "tv-and-film";

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockUseLiveChannels = jest.fn();
const mockGetAsset = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (href: unknown) => mockPush(href) },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ sectionSlug: SECTION_SLUG }),
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  PlaySession: { createPlaySession: jest.fn() },
  ContentCatalogue: {
    getAsset: mockGetAsset,
    getCollection: jest.fn(),
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

jest.mock("@/features/live-channels/hooks/use-live-channels", () => ({
  useLiveChannels: () => mockUseLiveChannels(),
}));

jest.mock("@/features/top-navigation/components/top-navigation-header", () => ({
  TopNavigationHeader: () => null,
}));

const SectionScreen = require("@/app/(tabs)/[sectionSlug]").default;

import {
  createCategory,
  createItem,
  createRail,
} from "../../__fixtures__/content";

const {
  appContentQueryOptions,
} = require("@/features/content-rails/app-content");

const vodRail = createRail({
  category: createCategory({ id: "vod-rail", name: "Movies" }),
  items: [
    createItem({
      contentType: "standalone",
      id: "vod-1",
      title: "Top Gun Maverick",
    }),
  ],
});
const liveRail = createRail({
  category: createCategory({ id: "live-rail", name: "Channels" }),
  items: [
    createItem({
      contentType: "episode",
      id: "programme-1",
      title: "Home and Away",
    }),
  ],
});

const sectionContent = {
  navigation: {
    category: createCategory({ id: "root", name: "Root" }),
    children: [
      { category: createCategory({ id: "TvAndFilm", name: "TV & Film" }) },
    ],
  },
  sections: [
    {
      navigationItem: createCategory({ id: "TvAndFilm", name: "TV & Film" }),
      pageCategory: createCategory({
        id: "tv-and-film-page",
        name: "TV & Film",
      }),
      rails: [vodRail, liveRail],
      route: `/${SECTION_SLUG}`,
    },
  ],
};

function renderSectionScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  queryClient.setQueryData(appContentQueryOptions.queryKey, sectionContent);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<SectionScreen />, { wrapper });
}

afterEach(() => {
  appQueryClient.clear();
});

describe("<SectionScreen />", () => {
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
          currentProgramme: { id: "programme-1", title: "Home and Away" },
          id: "channel-1",
          name: "Channel One",
        },
      ],
      error: null,
      isLoading: false,
    });
  });

  test("renders the section's rails and items from the SDK", () => {
    const { getByText } = renderSectionScreen();

    getByText("Movies");
    getByText("Top Gun Maverick");
  });

  test("opens the watch details page of its own tab for an on-demand rail item", () => {
    const { getByText } = renderSectionScreen();

    fireEvent.press(getByText("Top Gun Maverick"));

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { assetId: "vod-1", sectionSlug: SECTION_SLUG },
      pathname: "/[sectionSlug]/watch/[assetId]",
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("plays the channel airing a live programme selected from a rail", async () => {
    const { getByText } = renderSectionScreen();

    fireEvent.press(getByText("Home and Away"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        params: { channelId: "channel-1" },
        pathname: "/player/live/[channelId]",
      });
    });
  });
});
