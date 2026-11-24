jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  usePlaybackAuthorization: () => async () => true,
}));

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import { PROGRESS_TICK_MS } from "@/features/content-rails/components/content-tile/use-programme-progress";
import { LiveChannelsRail } from "@/features/live-channels/components/live-channels-rail";
import type { LiveChannel } from "@/features/live-channels/types";
import { appQueryClient } from "@/infra/query/app-query-client";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  PlaySession: { createPlaySession: jest.fn() },
}));

const mockCreatePlaySession = jest.requireMock("@bfbs/common-sdk").PlaySession
  .createPlaySession as jest.Mock;

const channel: LiveChannel = {
  currentProgramme: {
    durationSeconds: 3600,
    id: "programme-1",
    startDateTime: "2026-07-20T14:00:00.000Z",
    title: "Liverpool vs PSG",
  },
  id: "channel-1",
  name: "BBC One",
};

afterEach(() => {
  appQueryClient.clear();
});

function getProgressFillPercent(): number {
  const track = screen.getByTestId("content-tile-progress");
  const [fill] = track.children;

  if (typeof fill === "string") {
    throw new Error("Expected the progress track to contain a fill element");
  }

  const { style } = fill.props as { style: { width: string } };

  return Number.parseFloat(style.width);
}

describe("LiveChannelsRail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePlaySession.mockResolvedValue({
      id: "session-1",
      manifestUrl: "https://example.com/live.m3u8",
    });
  });

  test("renders a tile per live channel", () => {
    render(
      <LiveChannelsRail
        channels={[channel]}
        isLoading={false}
        isTablet={false}
      />,
    );

    expect(screen.getByText("Live Channels")).toBeTruthy();
    expect(screen.getByText("Liverpool vs PSG")).toBeTruthy();
  });

  test("renders a skeleton while loading, holding the rail's place", () => {
    render(<LiveChannelsRail channels={[]} isLoading isTablet={false} />);

    // The heading stays put and placeholder tiles reserve the rail's height, so
    // the content below does not jump once the real tiles arrive.
    expect(screen.getByTestId("content-rail-skeleton")).toBeTruthy();
    expect(screen.getByText("Live Channels")).toBeTruthy();
  });

  test("renders nothing when there is no data (e.g. a failed initial load)", () => {
    render(
      <LiveChannelsRail channels={[]} isLoading={false} isTablet={false} />,
    );

    expect(screen.queryByTestId("content-rail-skeleton")).toBeNull();
    expect(screen.queryByText("Live Channels")).toBeNull();
  });

  test("renders its tiles even when the caller has a background refresh error, as long as channels are present", () => {
    // LiveChannelsRail is presentational: it only ever sees `channels` and
    // `isLoading`, never the refresh error surfaced by the data hook. A
    // transient background-refresh failure must therefore not blank a rail
    // that already has cached data to show.
    render(
      <LiveChannelsRail
        channels={[channel]}
        isLoading={false}
        isTablet={false}
      />,
    );

    expect(screen.getByText("Live Channels")).toBeTruthy();
    expect(screen.getByText("Liverpool vs PSG")).toBeTruthy();
  });

  test("navigates to the live player when a tile is pressed", async () => {
    render(
      <LiveChannelsRail
        channels={[channel]}
        isLoading={false}
        isTablet={false}
      />,
    );
    await userEvent.press(screen.getByLabelText("Liverpool vs PSG"));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith({
        params: { channelId: "channel-1" },
        pathname: "/player/live/[channelId]",
      });
    });
  });

  test("uses the caller's press handler when one is provided", async () => {
    const onTilePress = jest.fn();

    render(
      <LiveChannelsRail
        channels={[channel]}
        isLoading={false}
        isTablet={false}
        onTilePress={onTilePress}
      />,
    );

    await userEvent.press(screen.getByLabelText("Liverpool vs PSG"));

    expect(onTilePress).toHaveBeenCalledWith(channel);
    expect(router.push).not.toHaveBeenCalled();
  });

  test("advances the progress bar as the ticker fires", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-20T14:15:00.000Z"));

    try {
      render(
        <LiveChannelsRail
          channels={[channel]}
          isLoading={false}
          isTablet={false}
        />,
      );

      const initialProgress = getProgressFillPercent();

      act(() => {
        jest.advanceTimersByTime(PROGRESS_TICK_MS);
      });

      const laterProgress = getProgressFillPercent();

      expect(laterProgress).toBeGreaterThan(initialProgress);
    } finally {
      jest.useRealTimers();
    }
  });
});
