import type { ContentItem } from "@bfbs/common-sdk";
import { fireEvent, render } from "@testing-library/react-native";
import { WatchDetailsScreen } from "@/features/watch-details/watch-details-screen";

const mockUseAsset = jest.fn();
const mockUseShow = jest.fn();
const mockUseShowEpisode = jest.fn();
const mockOpenVodAsset = jest.fn();
const mockToggleMyList = jest.fn();
let mockIsTablet = false;

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ showId: "show-1" }),
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("@/features/watch-details/hooks/use-asset", () => ({
  useAsset: (assetId: string | undefined) => mockUseAsset(assetId),
}));

jest.mock("@/features/watch-details/hooks/use-show", () => ({
  useShow: (showId: string | undefined) => mockUseShow(showId),
}));

jest.mock("@/features/watch-details/hooks/use-show-episode", () => ({
  useShowEpisode: (showId: string | undefined) => mockUseShowEpisode(showId),
}));

jest.mock("@/features/watch-details/hooks/use-show-seasons", () => ({
  useShowSeasons: () => ({ data: undefined }),
}));

jest.mock("@/features/watch-details/hooks/use-season-episodes", () => ({
  useSeasonEpisodes: () => ({
    episodes: [],
    hasError: false,
    isLoadingFirstPage: false,
    retry: jest.fn(),
  }),
}));

jest.mock("@/features/watch-details/hooks/use-related-assets", () => ({
  useRelatedAssets: () => ({ isError: false, isLoading: false, items: [] }),
}));

jest.mock("@/features/video-player", () => ({
  usePlaybackLauncher: () => ({ openVodAsset: mockOpenVodAsset }),
}));

jest.mock("@/features/favourites", () => ({
  useToggleFavourite: () => ({ isPending: false, mutate: mockToggleMyList }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("@/utils/device-layout", () => ({
  ...jest.requireActual("@/utils/device-layout"),
  isTabletLayout: () => mockIsTablet,
}));

const SHOW: ContentItem = {
  contentType: "show",
  credits: { actors: ["Steve Carell"] },
  id: "show-1",
  title: "The Office",
};

function renderSeries({
  episode,
  episodeQuery = {},
  show = SHOW,
}: {
  episode: ContentItem | null | undefined;
  // Extra episode query state, e.g. isLoading or isLoadingError.
  episodeQuery?: Record<string, unknown>;
  show?: ContentItem;
}) {
  mockUseAsset.mockReturnValue({ data: undefined, isLoading: false });
  mockUseShow.mockReturnValue({
    data: show,
    isError: false,
    isLoading: false,
    refetch: jest.fn(),
  });
  mockUseShowEpisode.mockReturnValue({ data: episode, ...episodeQuery });

  return render(<WatchDetailsScreen />);
}

describe("<WatchDetailsScreen /> for a series", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTablet = false;
  });

  test("loads the show from the route's show id", () => {
    renderSeries({ episode: undefined });

    expect(mockUseShow).toHaveBeenCalledWith("show-1");
    expect(mockUseShowEpisode).toHaveBeenCalledWith("show-1");
    expect(mockUseAsset).toHaveBeenCalledWith(undefined);
  });

  test("a partly watched episode fills the hero and offers Resume", () => {
    const { getByText } = renderSeries({
      episode: {
        contentType: "episode",
        durationSeconds: 1800,
        episodeNumber: "4",
        genres: ["Comedy"],
        id: "episode-4",
        lastPlayPositionSeconds: 600,
        seasonNumber: "9",
        title: "The Office",
      },
    });

    getByText("Resume S9 E4");
    getByText("20m remaining");
    getByText("Comedy");
  });

  test("Watch plays the first episode, not the show", () => {
    const { getByTestId, getByText } = renderSeries({
      episode: {
        contentType: "episode",
        episodeNumber: "1",
        id: "episode-1",
        seasonNumber: "1",
        title: "Episode one",
      },
    });

    getByText("Watch S1 E1");
    fireEvent.press(getByTestId("watch-details-watch"));

    expect(mockOpenVodAsset).toHaveBeenCalledWith({
      id: "episode-1",
      title: "Episode one",
    });
  });

  test("names only the episode when there is no season", () => {
    const { getByText } = renderSeries({
      episode: {
        contentType: "episode",
        episodeNumber: "1",
        id: "episode-1",
        title: "Big Daddy",
      },
    });

    getByText("Watch E1");
  });

  test("waits for the episode before showing the page", () => {
    const { getByTestId, queryByText } = renderSeries({
      episode: undefined,
      episodeQuery: { isLoading: true },
    });

    getByTestId("watch-details-skeleton");
    expect(queryByText("The Office")).toBeNull();
  });

  test("shows the error screen when the episode fails to load, and Refresh retries it", () => {
    const refetchEpisode = jest.fn();
    const { getByTestId } = renderSeries({
      episode: undefined,
      episodeQuery: {
        error: new Error("Request failed"),
        isLoadingError: true,
        refetch: refetchEpisode,
      },
    });

    getByTestId("error-full-screen");
    fireEvent.press(getByTestId("error-action-refresh"));

    expect(refetchEpisode).toHaveBeenCalledTimes(1);
  });

  test("keeps the page when an episode refresh fails", () => {
    const { getByText, queryByTestId } = renderSeries({
      episode: {
        contentType: "episode",
        episodeNumber: "1",
        id: "episode-1",
        seasonNumber: "1",
        title: "Episode one",
      },
      episodeQuery: {
        error: new Error("Request failed"),
        isError: true,
        isLoadingError: false,
      },
    });

    getByText("Watch S1 E1");
    expect(queryByTestId("error-full-screen")).toBeNull();
  });

  test("an unwatched show uses its episode's metadata", () => {
    const { getByText } = renderSeries({
      episode: {
        contentType: "episode",
        genres: ["Comedy"],
        id: "episode-1",
        title: "Episode one",
      },
    });

    getByText("Comedy");
  });

  test("uses the episode's synopsis when the show has none", () => {
    const { getByText } = renderSeries({
      episode: {
        contentType: "episode",
        id: "episode-1",
        synopsis: "Episode synopsis",
        title: "Episode one",
      },
    });

    getByText("Episode synopsis");
  });

  test("shows the series tabs with an empty pane per tab", () => {
    const { getByTestId, getByText } = renderSeries({
      episode: { contentType: "episode", id: "episode-1", title: "One" },
    });

    getByText("Episodes");
    getByText("More Details");
    getByTestId("series-tab-pane-episodes");

    fireEvent.press(getByText("Related"));

    getByTestId("series-tab-pane-related");
  });

  test("hides Watch and the Episodes tab when the show has no episode", () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = renderSeries(
      { episode: null },
    );

    expect(queryByTestId("watch-details-watch")).toBeNull();
    getByTestId("no-episodes-message");
    expect(queryByText("Episodes")).toBeNull();
    getByText("Related");
    getByText("More Details");
  });

  test("More Details shows the show's details, not its episode's", () => {
    const { getByText, queryByText } = renderSeries({
      episode: {
        contentType: "episode",
        id: "episode-1",
        synopsis: "Episode synopsis",
        title: "One",
      },
    });

    fireEvent.press(getByText("More Details"));

    getByText("Steve Carell");
    // The episode's synopsis fills the hero, never More Details.
    expect(queryByText("Description")).toBeNull();
  });

  test("hides More Details when the show has no details", () => {
    const { getByText, queryByText } = renderSeries({
      episode: { contentType: "episode", id: "episode-1", title: "One" },
      show: { contentType: "show", id: "show-1", title: "The Office" },
    });

    getByText("Related");
    expect(queryByText("More Details")).toBeNull();
  });

  test("My List saves the whole show", () => {
    const { getByTestId } = renderSeries({ episode: undefined });

    fireEvent.press(getByTestId("watch-details-my-list"));

    expect(mockToggleMyList).toHaveBeenCalledWith({
      isFavourite: false,
      showId: "show-1",
    });
  });

  test("tablet swaps Related and More Details for the series tabs", () => {
    mockIsTablet = true;

    const { getByTestId, getByText } = renderSeries({
      episode: { contentType: "episode", id: "episode-1", title: "One" },
    });

    getByText("Episodes");
    getByTestId("series-tab-pane-episodes");
  });
});
