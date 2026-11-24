jest.mock("@bfbs/common-sdk", () => ({
  ContentCategoryTemplate: {
    SIXTEEN_BY_NINE_STANDARD: "SIXTEEN_BY_NINE_STANDARD",
  },
  ContentSource: { LTV: "ltv", VOD: "vod" },
  Search: {
    getSearchResultsForTerm: jest.fn(() =>
      Promise.resolve({
        items: [],
        metadata: { count: 0, total: 0 },
        query: "military history",
      }),
    ),
    getTopSearches: jest.fn(() =>
      Promise.resolve({
        items: [],
        metadata: { count: 0, total: 0 },
      }),
    ),
  },
  SearchMatchMode: {
    PREFIX: "PREFIX",
  },
  SearchSortField: {
    DATE: "DATE",
  },
}));

const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockOpenLiveChannel = jest.fn(() => Promise.resolve());
let mockFocusCleanup: (() => void) | undefined;
let mockPreviousFocusEffect: (() => (() => void) | undefined) | undefined;
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    if (effect !== mockPreviousFocusEffect) {
      mockFocusCleanup?.();
      mockPreviousFocusEffect = effect;
      mockFocusCleanup = effect();
    }
  },
  useRouter: () => ({ back: mockBack, navigate: mockNavigate }),
}));

jest.mock("@/features/live-channels", () => ({
  ChannelsRail: jest.requireActual(
    "@/features/live-channels/components/channels-rail/channels-rail",
  ).ChannelsRail,
  toLiveTile: jest.requireActual("@/features/live-channels/to-live-tile")
    .toLiveTile,
  useLiveChannels: () => ({
    channels: [{ id: "channel-1", name: "BFBS Channel" }],
    isLoading: false,
  }),
}));

jest.mock("@/features/video-player", () => ({
  usePlaybackLauncher: () => ({ openLiveChannel: mockOpenLiveChannel }),
}));

import { Search } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Keyboard } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SearchScreen } from "@/features/search";

const queryClients = new Set<QueryClient>();

const initialMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

function renderSearchScreen(onSubmit?: (query: string) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  queryClients.add(queryClient);

  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        {onSubmit ? <SearchScreen onSubmit={onSubmit} /> : <SearchScreen />}
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

describe("SearchScreen", () => {
  beforeEach(() => {
    mockFocusCleanup = undefined;
    mockPreviousFocusEffect = undefined;
    jest.clearAllMocks();
  });

  afterEach(() => {
    for (const queryClient of queryClients) {
      queryClient.clear();
    }
    queryClients.clear();
    jest.restoreAllMocks();
  });

  it("renders a controlled search field", () => {
    const { getByTestId, queryByText } = renderSearchScreen();

    expect(getByTestId("search-screen")).toBeTruthy();
    expect(getByTestId("search-back")).toBeTruthy();
    expect(getByTestId("search-no-results")).toBeTruthy();
    expect(getByTestId("content-rail-skeleton")).toBeTruthy();
    expect(
      queryByText("Sorry, we can’t find what you’re looking for."),
    ).toBeNull();

    const input = getByTestId("search-input");
    fireEvent(input, "focus");
    fireEvent.changeText(input, "military history");
    fireEvent(input, "blur");

    expect(input).toHaveProp("value", "military history");
  });

  it("returns to the route that opened Search", () => {
    const { getByTestId } = renderSearchScreen();

    fireEvent.press(getByTestId("search-back"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("submits once and preserves the controlled query", async () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderSearchScreen(onSubmit);
    const input = getByTestId("search-input");

    fireEvent.changeText(input, "military history");
    fireEvent(input, "submitEditing");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("military history");
    expect(input).toHaveProp("value", "military history");
    await waitFor(() =>
      expect(Search.getSearchResultsForTerm).toHaveBeenCalledTimes(2),
    );
  });

  it("dismisses the keyboard when the user taps outside the field", () => {
    const dismissKeyboard = jest
      .spyOn(Keyboard, "dismiss")
      .mockImplementation(() => {});
    const { getByTestId } = renderSearchScreen();

    fireEvent.press(getByTestId("search-screen-dismiss-keyboard"));

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
  });

  it("dismisses an empty search field when recommendations are touched", () => {
    const dismissKeyboard = jest
      .spyOn(Keyboard, "dismiss")
      .mockImplementation(() => {});
    const { getByTestId } = renderSearchScreen();

    fireEvent(getByTestId("search-no-results"), "touchStart");

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
  });

  it("opens a recommended channel without clearing the query", () => {
    const { getByLabelText, getByTestId } = renderSearchScreen();
    const input = getByTestId("search-input");
    fireEvent.changeText(input, "military history");
    fireEvent.press(getByLabelText("BFBS Channel"));

    act(() => {
      mockFocusCleanup?.();
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { channelId: "channel-1" },
      pathname: "/search/channel/[channelId]",
    });
    expect(input).toHaveProp("value", "military history");
  });

  it("clears the query when navigating away from Search", () => {
    const { getByTestId } = renderSearchScreen();
    const input = getByTestId("search-input");
    fireEvent.changeText(input, "military history");

    act(() => {
      mockFocusCleanup?.();
    });

    expect(input).toHaveProp("value", "");
  });

  it("opens VOD search results without clearing the query", async () => {
    jest.mocked(Search.getSearchResultsForTerm).mockResolvedValueOnce({
      items: [
        {
          contentType: "standalone",
          id: "vod-1",
          title: "Military History",
        },
      ],
      query: "military history",
    });
    const { getByLabelText, getByTestId } = renderSearchScreen();

    fireEvent.changeText(getByTestId("search-input"), "military history");
    fireEvent(getByTestId("search-input"), "submitEditing");
    fireEvent.press(await waitFor(() => getByLabelText("Military History")));

    act(() => {
      mockFocusCleanup?.();
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { assetId: "vod-1" },
      pathname: "/search/watch/[assetId]",
    });
    expect(getByTestId("search-input")).toHaveProp("value", "military history");
  });

  it("returns to recommendations when a query has no results", async () => {
    const { getByText, getByTestId } = renderSearchScreen();

    fireEvent.changeText(getByTestId("search-input"), "nothing here");
    fireEvent(getByTestId("search-input"), "submitEditing");

    expect(await waitFor(() => getByTestId("search-no-results"))).toBeTruthy();
    expect(
      getByText("Sorry, we can’t find what you’re looking for."),
    ).toBeTruthy();
  });

  it("launches live search results through playback preparation", async () => {
    jest.mocked(Search.getSearchResultsForTerm).mockResolvedValueOnce({
      items: [
        {
          contentType: "channel",
          id: "channel-1",
          title: "BFBS Live",
        },
      ],
      query: "bfbs live",
    });
    const { getByLabelText, getByTestId } = renderSearchScreen();

    fireEvent.changeText(getByTestId("search-input"), "bfbs live");
    fireEvent(getByTestId("search-input"), "submitEditing");
    fireEvent.press(await waitFor(() => getByLabelText("BFBS Channel")));

    expect(mockOpenLiveChannel).toHaveBeenCalledWith("channel-1");
  });
});
