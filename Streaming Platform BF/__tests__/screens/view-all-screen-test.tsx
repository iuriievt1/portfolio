import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";

let mockSearchParams: Record<string, string> = { railId: "vod-rail" };

const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockGetCollectionContent = jest.fn();

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({
    back: jest.fn(),
    navigate: mockNavigate,
    push: mockPush,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ContentCatalogue: {
    getCollectionContent: (input: unknown) => mockGetCollectionContent(input),
    getNavigation: () => new Promise(() => undefined),
  },
  ContentCategoryTemplate: {
    SIXTEEN_BY_NINE_STANDARD: "SIXTEEN_BY_NINE_STANDARD",
  },
}));

const { ViewAllScreen } = require("@/features/content-rails/view-all-screen");
const {
  appContentQueryOptions,
} = require("@/features/content-rails/app-content");

const railWithItems = createRail({
  category: createCategory({ id: "vod-rail", name: "Popular Films" }),
  items: [
    { contentType: "standalone", id: "vod-1", title: "First" },
    { contentType: "channel", id: "channel-1", title: "Second" },
  ],
});

const sportItem = {
  contentType: "standalone",
  id: "vod-9",
  title: "Only on Sport",
} as const;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
}

function renderWith(queryClient: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<ViewAllScreen />, { wrapper });
}

function renderScreen() {
  const queryClient = createQueryClient();
  queryClient.setQueryData(appContentQueryOptions.queryKey, {
    navigation: {
      category: { id: "root", name: "Root" },
      children: [],
    },
    sections: [
      {
        navigationItem: { id: "home", name: "Home" },
        pageCategory: { id: "home", name: "Home" },
        rails: [railWithItems],
        route: "/",
      },
    ],
  });

  return renderWith(queryClient);
}

import { createCategory, createRail } from "../../__fixtures__/content";

describe("ViewAllScreen", () => {
  beforeEach(() => {
    mockSearchParams = { railId: "vod-rail" };
    mockNavigate.mockClear();
    mockPush.mockClear();
    mockGetCollectionContent.mockResolvedValue({
      items: railWithItems.items,
      metadata: { total: 2 },
    });
  });

  test("shows the skeleton until the rail's first page arrives", () => {
    mockGetCollectionContent.mockReturnValue(new Promise(() => undefined));

    const { getByTestId, queryByText } = renderScreen();

    getByTestId("content-grid-skeleton");
    expect(queryByText("First")).toBeNull();
  });

  test("opens the watch details page in the tab it sits in", async () => {
    const { findByText } = renderScreen();

    fireEvent.press(await findByText("First"));

    expect(mockNavigate).toHaveBeenCalledWith("../watch/vod-1");
  });

  test("opens a series item on its show page in the tab it sits in", async () => {
    mockGetCollectionContent.mockResolvedValue({
      items: [
        {
          contentType: "show",
          id: "show-1~vod",
          showId: "show-1",
          title: "A Series",
        },
      ],
      metadata: { total: 1 },
    });

    const { findByText } = renderScreen();

    fireEvent.press(await findByText("A Series"));

    expect(mockNavigate).toHaveBeenCalledWith("../show/show-1");
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("holds the grid's shape while the app content loads", () => {
    const { getByTestId, queryByText } = renderWith(createQueryClient());

    getByTestId("content-grid-skeleton");
    getByTestId("content-grid-title-block");
    expect(queryByText("This rail is unavailable.")).toBeNull();
  });

  test("reports an unavailable rail only once the content has loaded", () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(appContentQueryOptions.queryKey, {
      navigation: { id: "root", name: "Root" },
      sections: [],
    });

    const { getByText, queryByTestId } = renderWith(queryClient);

    getByText("Content Unavailable");
    getByText("PLAY_002");
    expect(queryByTestId("content-grid-skeleton")).toBeNull();
  });

  test("shows the rail from the section it was opened from", async () => {
    mockSearchParams = { railId: "vod-rail", sectionRoute: "/sport" };

    const queryClient = createQueryClient();
    queryClient.setQueryData(appContentQueryOptions.queryKey, {
      navigation: { id: "root", name: "Root" },
      sections: [
        {
          navigationItem: { id: "home", name: "Home" },
          page: { id: "home", name: "Home" },
          rails: [railWithItems],
          route: "/",
        },
        {
          navigationItem: { id: "sport", name: "Sport" },
          page: { id: "sport", name: "Sport" },
          rails: [
            {
              ...railWithItems,
              category: createCategory({ id: "vod-rail", name: "Sport Films" }),
              items: [sportItem],
            },
          ],
          route: "/sport",
        },
      ],
    });

    const { findByText, queryByText } = renderWith(queryClient);

    await findByText("Sport Films");
    expect(queryByText("Popular Films")).toBeNull();
  });

  test("falls back to the player for an item that is not a VOD asset", async () => {
    const { findByText } = renderScreen();

    fireEvent.press(await findByText("Second"));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      params: { id: "channel-1", title: "Second" },
      pathname: "/player/vod/[id]",
    });
  });
});
