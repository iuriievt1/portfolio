import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";

const STATUS_BAR_INSET = 59;

function flatten(style: unknown) {
  return StyleSheet.flatten(style) as Record<string, number>;
}

const mockBack = jest.fn();
const mockPush = jest.fn();

let mockLayout = {
  height: 852,
  isLandscape: false,
  isTablet: false,
  width: 393,
};

jest.mock("@/hooks/use-device-layout", () => ({
  useDeviceLayout: () => mockLayout,
}));

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: STATUS_BAR_INSET,
  }),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ContentCatalogue: {
    getAllChannels: jest.fn(),
    getProgrammeGuide: jest.fn(),
  },
}));

import { ContentCatalogue } from "@bfbs/common-sdk";
import {
  FullGuideScreen,
  formatDayLabel,
  getGuideDays,
  getGuideMetrics,
  getLookbackStartMs,
  getPixelsPerMinute,
  getTimeline,
  getTimelineWidth,
} from "@/features/full-guide";
import {
  setWatchedChannelId,
  useWatchedChannelId,
} from "@/features/live-channels";

const mockGetAllChannels = ContentCatalogue.getAllChannels as jest.Mock;
const mockGetProgrammeGuide = ContentCatalogue.getProgrammeGuide as jest.Mock;

const NOW_MS = Date.now();

function at(offsetMinutes: number) {
  return new Date(NOW_MS + offsetMinutes * 60_000).toISOString();
}

function cellId(channelId: string, offsetMinutes: number) {
  return `${channelId}-${NOW_MS + offsetMinutes * 60_000}`;
}

function guideFixture() {
  return {
    channels: [
      {
        channelId: "one",
        programmes: [
          {
            expirationDateTime: at(30),
            id: "on-one",
            media: [{ type: "image", url: "https://images.test/on-one.jpg" }],
            synopsis: "A businessman appoints his daughter as sole heir.",
            startDateTime: at(-30),
            title: "On One Now",
          },
          {
            expirationDateTime: at(90),
            id: "later-one",
            startDateTime: at(30),
            title: "On One Later",
          },
        ],
      },
      {
        channelId: "two",
        programmes: [
          {
            expirationDateTime: at(30),
            id: "on-two",
            startDateTime: at(-30),
            title: "On Two Now",
          },
        ],
      },
    ],
  };
}

function renderScreen(channelId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return render(<FullGuideScreen channelId={channelId} />, {
    wrapper: Wrapper,
  });
}

describe("<FullGuideScreen />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLayout = {
      height: 852,
      isLandscape: false,
      isTablet: false,
      width: 393,
    };
    mockGetAllChannels.mockResolvedValue([
      { id: "one", logicalChannelNumber: 1, name: "One" },
      { id: "two", logicalChannelNumber: 2, name: "Two" },
    ]);
    mockGetProgrammeGuide.mockResolvedValue(guideFixture());
  });

  test("gives a tablet the watch details hero, artwork and all", async () => {
    mockLayout = {
      height: 1180,
      isLandscape: false,
      isTablet: true,
      width: 820,
    };

    const { getByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-hero");
    });

    getByTestId("programme-artwork-image");
    expect(getByTestId("full-guide-watch-now").props.style.width).toBe(174);
    const artwork = flatten(getByTestId("full-guide-artwork").props.style);

    expect(artwork.height).toBeCloseTo(297);
    expect(artwork.width).toBeCloseTo(506);
    expect(
      flatten(getByTestId("full-guide-hero").props.style).minHeight,
    ).toBeCloseTo(297);
    expect(
      flatten(getByTestId("full-guide-hero-synopsis").props.style).maxWidth,
    ).toBeCloseTo(408.45);
    expect(
      flatten(getByTestId("full-guide-hero-title").props.style).maxWidth,
    ).toBeCloseTo(408.45);
  });

  test("draws the tablet artwork at its designed size in landscape", async () => {
    mockLayout = {
      height: 820,
      isLandscape: true,
      isTablet: true,
      width: 1180,
    };

    const { getByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-artwork");
    });

    const artwork = flatten(getByTestId("full-guide-artwork").props.style);

    expect(artwork.height).toBeCloseTo(344);
    expect(artwork.width).toBeCloseTo(652);
    expect(
      flatten(getByTestId("full-guide-hero").props.style).minHeight,
    ).toBeCloseTo(344);
    const synopsis = getByTestId("full-guide-hero-synopsis");
    expect(flatten(synopsis.props.style).maxWidth).toBeCloseTo(511.35);
    expect(
      flatten(getByTestId("full-guide-hero-title").props.style).maxWidth,
    ).toBeCloseTo(511.35);
    expect(synopsis.props.numberOfLines).toBe(2);
    expect(getByTestId("full-guide-hero-title").props.numberOfLines).toBe(2);
  });

  test("sizes the tablet's action button as the designs do", async () => {
    mockLayout = {
      height: 820,
      isLandscape: true,
      isTablet: true,
      width: 1180,
    };

    const { getByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-watch-now");
    });

    expect(getByTestId("full-guide-watch-now").props.style.width).toBe(264);
  });

  test("keeps the guide clear of the status bar", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-hero");
    });

    expect(getByTestId("full-guide-screen").props.style.paddingTop).toBe(
      STATUS_BAR_INSET,
    );
  });

  test("holds the guide's shape while it loads", () => {
    mockGetAllChannels.mockReturnValue(new Promise(() => {}));

    const { getByTestId, queryByTestId } = renderScreen();

    getByTestId("full-guide-skeleton");
    expect(queryByTestId("full-guide-timeline")).toBeNull();
  });

  test("shows the error page when the guide fails to load", async () => {
    mockGetProgrammeGuide.mockRejectedValue(new Error("guide is down"));

    const { getByTestId, getByText } = renderScreen();

    await waitFor(() => {
      getByTestId("error-full-screen");
    });

    getByText("Something went wrong");
    getByText("SYS_002");
  });

  test("reloads the guide from the error page", async () => {
    mockGetProgrammeGuide.mockRejectedValue(new Error("guide is down"));

    const { getByText } = renderScreen();

    await waitFor(() => {
      getByText("Refresh");
    });

    const callsBeforeRefresh = mockGetProgrammeGuide.mock.calls.length;
    fireEvent.press(getByText("Refresh"));

    await waitFor(() => {
      expect(mockGetProgrammeGuide.mock.calls.length).toBeGreaterThan(
        callsBeforeRefresh,
      );
    });
  });

  test("leaves the guide when there is nothing to show", async () => {
    mockGetAllChannels.mockResolvedValue([]);

    const { getByTestId, getByText } = renderScreen();

    await waitFor(() => {
      getByTestId("error-full-screen");
    });

    getByText("PLAY_002");
  });

  test("opens on what is live on the first channel", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId("full-guide-hero-title").props.children).toBe(
        "On One Now",
      );
    });
  });

  test("keeps a phone's title to one line, trailing off when it is long", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-hero-title");
    });

    const title = getByTestId("full-guide-hero-title");

    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.ellipsizeMode ?? "tail").toBe("tail");
  });

  test("opens on the channel it was asked for", async () => {
    const { getByTestId } = renderScreen("two");

    await waitFor(() => {
      expect(getByTestId("full-guide-hero-title").props.children).toBe(
        "On Two Now",
      );
    });
  });

  test("follows a channel the user switches to in the player", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId("full-guide-hero-title").props.children).toBe(
        "On One Now",
      );
    });

    act(() => {
      setWatchedChannelId("two");
    });

    expect(getByTestId("full-guide-hero-title").props.children).toBe(
      "On Two Now",
    );
  });

  test("offers Watch Now for a live programme and opens the player", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-watch-now");
    });

    fireEvent.press(getByTestId("full-guide-watch-now"));

    expect(mockPush).toHaveBeenCalledWith({
      params: { channelId: "one" },
      pathname: "/player/live/[channelId]",
    });
    expect(renderHook(useWatchedChannelId).result.current).toBe("one");
  });

  test("returns to the previous page from the hero", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-back");
    });

    fireEvent.press(getByTestId("full-guide-back"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test("moves the hero to an upcoming programme and hides Watch Now", async () => {
    const { getByTestId, getByText, queryByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId(`guide-cell-${cellId("one", 30)}`);
    });

    fireEvent.press(getByTestId(`guide-cell-${cellId("one", 30)}`));

    expect(getByTestId("full-guide-hero-title").props.children).toBe(
      "On One Later",
    );
    getByText("UPCOMING");
    expect(queryByTestId("full-guide-watch-now")).toBeNull();
  });

  test("tells the viewer when the schedule has nothing on air", async () => {
    mockGetProgrammeGuide.mockResolvedValue({
      channels: [
        {
          channelId: "one",
          programmes: [
            {
              expirationDateTime: at(-30),
              id: "earlier-one",
              startDateTime: at(-90),
              title: "On One Earlier",
            },
            {
              expirationDateTime: at(90),
              id: "later-one",
              startDateTime: at(30),
              title: "On One Later",
            },
          ],
        },
      ],
    });

    const { getByTestId, getByText } = renderScreen();

    await waitFor(() => {
      expect(getByTestId("full-guide-hero-title").props.children).toBe(
        "Programme Info Not Available",
      );
    });

    expect(getByTestId("full-guide-hero-synopsis").props.children).toBe(
      "Programme info not available.",
    );
    expect(
      getByTestId("programme-artwork-fallback-image").props.preserveAspectRatio,
    ).toBe("xMidYMid slice");
    getByText("LIVE");
    getByTestId("full-guide-watch-now");
  });

  test("lets the viewer look back half an hour, and no further", async () => {
    const openedAtMs = Date.now();
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-timeline-content");
    });

    const metrics = getGuideMetrics({ isLandscape: false, isTablet: false });
    const pixelsPerMinute = getPixelsPerMinute(mockLayout.width, metrics);
    const timeline = getTimeline(
      getGuideDays(openedAtMs),
      getLookbackStartMs({ metrics, openedAtMs, pixelsPerMinute }),
    );

    expect(
      flatten(getByTestId("full-guide-timeline-content").props.style).width,
    ).toBeCloseTo(getTimelineWidth(timeline, pixelsPerMinute), 0);
  });

  test("keeps the grid up while a further day is still loading", async () => {
    mockGetProgrammeGuide.mockImplementation(({ from }: { from: string }) =>
      Date.parse(from) <= NOW_MS
        ? Promise.resolve(guideFixture())
        : new Promise(() => {}),
    );
    const day = getGuideDays(NOW_MS)[3];

    const { getByTestId, getByText, queryByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("full-guide-timeline");
    });

    fireEvent.press(getByTestId("guide-day-label"));
    fireEvent.press(getByTestId(`guide-day-option-${day?.key}`));

    getByTestId("full-guide-timeline");
    getByText(formatDayLabel({ dayStartMs: day?.startMs ?? 0, nowMs: NOW_MS }));
    expect(queryByTestId("full-guide-skeleton")).toBeNull();
  });

  test("labels the day the guide opens on", async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId("guide-day-label")).toBeTruthy();
    });
  });

  test("opens the week from the day label", async () => {
    const { getByTestId, queryByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("guide-day-label");
    });

    expect(queryByTestId("guide-day-selector")).toBeNull();

    fireEvent.press(getByTestId("guide-day-label"));

    expect(getByTestId("guide-day-selector")).toBeTruthy();
  });

  test("closes the selector once a day is chosen", async () => {
    const { getAllByTestId, getByTestId, queryByTestId } = renderScreen();

    await waitFor(() => {
      getByTestId("guide-day-label");
    });

    fireEvent.press(getByTestId("guide-day-label"));

    const [firstOption] = getAllByTestId(/guide-day-option-/);

    if (firstOption) {
      fireEvent.press(firstOption);
    }

    expect(queryByTestId("guide-day-selector")).toBeNull();
  });
});
