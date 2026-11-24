import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AccessibilityInfo } from "react-native";

const mockBack = jest.fn();
const mockGetPage = jest.fn();
let mockLocalSearchParams: { categoryId?: string } = {
  categoryId: "provider-comedy",
};
const mockPush = jest.fn();
const mockSetAccessibilityFocus = jest
  .spyOn(AccessibilityInfo, "setAccessibilityFocus")
  .mockImplementation(() => {});

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockLocalSearchParams,
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  ContentCatalogue: {
    getCollectionContent: jest.fn(),
    getPage: mockGetPage,
  },
}));

jest.mock("@/features/live-channels", () => ({
  useLiveChannels: () => ({ channels: [], error: null, isLoading: false }),
}));

jest.mock("@/features/video-player", () => ({
  usePlaybackLauncher: () => ({ openLiveChannel: jest.fn() }),
}));

const mockUseWindowDimensions = jest.spyOn(
  require("react-native"),
  "useWindowDimensions",
);

const GenrePageScreen =
  require("@/features/genre-page/genre-page-screen").GenrePageScreen;

import {
  createCategory,
  createItem,
  createPage,
  createRail,
} from "../../__fixtures__/content";

const firstRail = createRail({
  category: createCategory({ id: "rail-one", name: "First rail" }),
  items: [
    createItem({
      contentType: "standalone",
      id: "asset-one",
      title: "First item",
    }),
  ],
});
const secondRail = createRail({
  category: createCategory({ id: "rail-two", name: "Second rail" }),
  items: [
    createItem({
      contentType: "standalone",
      id: "asset-two",
      title: "Second item",
    }),
  ],
});

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<GenrePageScreen />, { wrapper });
}

describe("GenrePageScreen", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockGetPage.mockReset();
    mockLocalSearchParams = { categoryId: "provider-comedy" };
    mockPush.mockClear();
    mockSetAccessibilityFocus.mockClear();
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1,
      height: 844,
      scale: 3,
      width: 390,
    });
  });

  test("shows the error state when the category id is missing", async () => {
    mockLocalSearchParams = {};

    renderScreen();

    expect(screen.queryByTestId("genre-page-loading")).toBeNull();
    expect(await screen.findByText("Back")).toBeTruthy();
    expect(mockGetPage).not.toHaveBeenCalled();
  });

  test("loads the provider category and renders only the back button above its rails", async () => {
    mockGetPage.mockResolvedValue(
      createPage(createCategory({ id: "provider-comedy", name: "Comedy" }), [
        firstRail,
        secondRail,
      ]),
    );

    renderScreen();

    expect(screen.getByTestId("genre-page-loading")).toBeTruthy();
    await screen.findByText("First item");

    expect(screen.getByTestId("content-grid-back")).toBeTruthy();
    expect(screen.queryByTestId("content-grid-title-block")).toBeNull();
    expect(screen.queryByText("Comedy")).toBeNull();

    expect(mockGetPage).toHaveBeenCalledWith({
      categoryId: "provider-comedy",
      collectionLimit: 16,
    });
    const railTitles = screen
      .getAllByRole("header")
      .map(({ props }) => props.children);
    expect(railTitles).toEqual(["First rail", "Second rail"]);
    expect(mockSetAccessibilityFocus).toHaveBeenCalledTimes(1);
  });

  test("hides a failed rail while keeping hydrated siblings", async () => {
    mockGetPage.mockResolvedValue({
      category: createCategory({ id: "provider-comedy", name: "Comedy" }),
      rails: [{ ...firstRail, items: undefined }, secondRail],
    });

    renderScreen();

    await screen.findByText("Second item");
    expect(screen.queryByText("First rail")).toBeNull();
  });

  test("shows an empty state when no rail contains renderable content", async () => {
    mockGetPage.mockResolvedValue(
      createPage(createCategory({ id: "provider-comedy", name: "Comedy" }), []),
    );

    renderScreen();

    expect(await screen.findByTestId("genre-page-empty")).toBeTruthy();
  });

  test("offers retry and back after a page-level load failure", async () => {
    mockGetPage.mockRejectedValueOnce(new Error("failed"));

    renderScreen();

    await screen.findByText("Retry");
    fireEvent.press(screen.getByText("Back"));
    expect(mockBack).toHaveBeenCalledTimes(1);

    mockGetPage.mockResolvedValue(
      createPage(createCategory({ id: "provider-comedy", name: "Comedy" }), [
        firstRail,
      ]),
    );
    fireEvent.press(screen.getByText("Retry"));

    await waitFor(() => expect(mockGetPage).toHaveBeenCalledTimes(2));
  });

  test("opens supported content and View All beneath the originating section", async () => {
    mockGetPage.mockResolvedValue(
      createPage(createCategory({ id: "provider-comedy", name: "Comedy" }), [
        {
          ...firstRail,
          metadata: { count: 16, total: 16 },
          items: Array.from({ length: 16 }, (_, index) =>
            createItem({
              contentType: "standalone",
              id: `asset-${index + 1}`,
              title: `Item ${index + 1}`,
            }),
          ),
        },
      ]),
    );

    renderScreen();

    fireEvent.press(await screen.findByText("Item 1"));
    expect(mockPush).toHaveBeenCalledWith({
      params: { assetId: "asset-1" },
      pathname: "/watch/[assetId]",
    });

    fireEvent.press(screen.getByLabelText("View All"));
    expect(mockPush).toHaveBeenCalledWith({
      params: { genreCategoryId: "provider-comedy", railId: "rail-one" },
      pathname: "/view-all/[railId]",
    });
  });

  test("uses the shared content action to open a series", async () => {
    mockGetPage.mockResolvedValue(
      createPage(createCategory({ id: "provider-comedy", name: "Comedy" }), [
        createRail({
          category: createCategory({ id: "shows", name: "Shows" }),
          items: [
            createItem({
              contentType: "show",
              id: "show-1",
              title: "Show One",
            }),
          ],
        }),
      ]),
    );

    renderScreen();

    fireEvent.press(await screen.findByText("Show One"));
    expect(mockPush).toHaveBeenCalledWith({
      params: { showId: "show-1" },
      pathname: "/show/[showId]",
    });
  });

  test("updates the shared rail layout after an orientation change", async () => {
    mockGetPage.mockResolvedValue(
      createPage(createCategory({ id: "provider-comedy", name: "Comedy" }), [
        firstRail,
      ]),
    );
    const view = renderScreen();

    await screen.findByText("First item");
    expect(
      screen.getByTestId("content-rail-scroll").props.contentContainerClassName,
    ).toContain("gap-2 px-3");

    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1,
      height: 820,
      scale: 2,
      width: 1180,
    });
    view.rerender(<GenrePageScreen />);

    expect(
      screen.getByTestId("content-rail-scroll").props.contentContainerClassName,
    ).toContain("gap-4 px-10");
  });
});
