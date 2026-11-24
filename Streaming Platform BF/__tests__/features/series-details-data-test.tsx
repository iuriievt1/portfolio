import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import type { ReactNode } from "react";

const mockGetContinueWatchingList = jest.fn();
const mockAddToFavourites = jest.fn();
const mockRemoveFromFavourites = jest.fn();
const mockNavigate = jest.fn();
const mockUseFavourites = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ContinueWatchingRecentSource: { NEXT_EPISODES: "nextEpisodes" },
  ContinueWatchingShowFilterDefault: { FIRST_EPISODE: "firstEpisode" },
  UserProfile: {
    addToFavourites: (input: unknown) => mockAddToFavourites(input),
    getContinueWatchingList: (input: unknown) =>
      mockGetContinueWatchingList(input),
    removeFromFavourites: (id: string) => mockRemoveFromFavourites(id),
  },
}));

jest.mock("@/infra/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

jest.mock("@/features/favourites/use-favourites", () => ({
  ...jest.requireActual("@/features/favourites/use-favourites"),
  useFavourites: () => mockUseFavourites(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

import { useToggleFavourite } from "@/features/favourites";
import { MyListPage } from "@/features/my-bfbs/pages/my-list-page";
import { useShowEpisode } from "@/features/watch-details/hooks/use-show-episode";

function createWrapper() {
  // gcTime 0 so a finished query doesn't keep Jest running.
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0, retry: false },
      queries: { gcTime: 0, retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useShowEpisode", () => {
  test("asks for the show's next episode, falling back to the first", async () => {
    const episode = { contentType: "episode", id: "episode-4", title: "E4" };
    mockGetContinueWatchingList.mockResolvedValue({ items: [episode] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useShowEpisode("show-1"), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(episode));
    expect(mockGetContinueWatchingList).toHaveBeenCalledWith({
      limit: 1,
      recentSource: "nextEpisodes",
      showFilterDefault: "firstEpisode",
      showId: "show-1",
    });
  });

  test("returns null when the show has no episode", async () => {
    mockGetContinueWatchingList.mockResolvedValue({ items: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useShowEpisode("show-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe("useToggleFavourite", () => {
  test("adds the whole show by its show id", async () => {
    mockAddToFavourites.mockResolvedValue(undefined);
    const { queryClient, wrapper } = createWrapper();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useToggleFavourite(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        isFavourite: false,
        showId: "show-1",
      });
    });

    expect(mockAddToFavourites).toHaveBeenCalledWith({ showId: "show-1" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["show", "show-1"] });
  });

  test("still adds an asset by its asset id", async () => {
    mockAddToFavourites.mockResolvedValue(undefined);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useToggleFavourite(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assetId: "asset-1",
        isFavourite: false,
      });
    });

    expect(mockAddToFavourites).toHaveBeenCalledWith({ assetId: "asset-1" });
  });

  test("removes a saved show by its show id", async () => {
    mockRemoveFromFavourites.mockResolvedValue(undefined);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useToggleFavourite(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ isFavourite: true, showId: "show-1" });
    });

    expect(mockRemoveFromFavourites).toHaveBeenCalledWith("show-1");
  });
});

describe("<MyListPage />", () => {
  test("opens a saved show on the series page with its plain show id", () => {
    mockUseFavourites.mockReturnValue({
      data: {
        items: [
          {
            contentType: "show",
            id: "tstv_1~vod",
            showId: "tstv_1",
            title: "The Office",
          },
        ],
      },
      isError: false,
      isPending: false,
      refetch: jest.fn(),
    });

    const { getByLabelText } = render(<MyListPage />);

    fireEvent.press(getByLabelText("The Office"));

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { showId: "tstv_1" },
      pathname: "/my-bfbs/show/[showId]",
    });
  });

  test("still opens a saved film on the watch page", () => {
    mockUseFavourites.mockReturnValue({
      data: {
        items: [{ contentType: "standalone", id: "film-1", title: "Big Fish" }],
      },
      isError: false,
      isPending: false,
      refetch: jest.fn(),
    });

    const { getByLabelText } = render(<MyListPage />);

    fireEvent.press(getByLabelText("Big Fish"));

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { assetId: "film-1" },
      pathname: "/my-bfbs/watch/[assetId]",
    });
  });
});
