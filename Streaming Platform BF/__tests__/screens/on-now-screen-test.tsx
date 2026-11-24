jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  usePlaybackAuthorization: () => async () => true,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { appQueryClient } from "@/infra/query/app-query-client";

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockUseLiveChannels = jest.fn();
const mockGetAsset = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (href: unknown) => mockPush(href) },
  useFocusEffect: jest.fn(),
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  PlaySession: { createPlaySession: jest.fn() },
  ContentCatalogue: {
    getAsset: mockGetAsset,
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

const OnNowScreen = require("@/app/(tabs)/on-now").default;

import {
  createCategory,
  createItem,
  createRail,
} from "../../__fixtures__/content";

const {
  appContentQueryOptions,
} = require("@/features/content-rails/app-content");

const liveRail = createRail({
  category: createCategory({ id: "live-rail", name: "Live Events" }),
  items: [
    createItem({
      contentType: "episode",
      id: "programme-1",
      title: "Hidden Assets",
    }),
  ],
});
const vodRail = createRail({
  category: createCategory({ id: "vod-rail", name: "BFBS News" }),
  items: [
    createItem({ contentType: "standalone", id: "vod-1", title: "News One" }),
  ],
});

const onNowContent = {
  navigation: {
    category: createCategory({ id: "root", name: "Root" }),
    children: [{ category: createCategory({ id: "LiveTV", name: "Live TV" }) }],
  },
  sections: [
    {
      navigationItem: createCategory({ id: "LiveTV", name: "Live TV" }),
      pageCategory: createCategory({ id: "on-now-page", name: "On Now" }),
      rails: [liveRail, vodRail],
      route: "/on-now",
    },
  ],
};

function renderOnNowScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  queryClient.setQueryData(appContentQueryOptions.queryKey, onNowContent);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<OnNowScreen />, { wrapper });
}

afterEach(() => {
  appQueryClient.clear();
});

describe("<OnNowScreen />", () => {
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
          currentProgramme: { id: "programme-1", title: "Hidden Assets" },
          id: "channel-1",
          name: "Channel One",
        },
      ],
    });
  });

  test("renders the section's rails and items from the SDK", () => {
    const { getByText } = renderOnNowScreen();

    getByText("Live Events");
    getByText("BFBS News");
    getByText("Hidden Assets");
    getByText("News One");
  });

  test("plays the channel airing a live programme selected from a rail", async () => {
    const { getByText } = renderOnNowScreen();

    fireEvent.press(getByText("Hidden Assets"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        params: { channelId: "channel-1" },
        pathname: "/player/live/[channelId]",
      });
    });
  });

  test("opens the watch details page of its own tab for an on-demand rail item", () => {
    const { getByText } = renderOnNowScreen();

    fireEvent.press(getByText("News One"));

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { assetId: "vod-1" },
      pathname: "/on-now/watch/[assetId]",
    });
  });
});
