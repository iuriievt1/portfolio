jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  usePlaybackAuthorization: () => async () => true,
}));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ChannelDetailsScreen } from "@/features/channel-details/channel-details-screen";
import { TIME_ZONE_PREFERENCE } from "@/features/my-bfbs/time-zone-preference";
import {
  resetTimeZonePreference,
  setTimeZonePreference,
} from "@/features/my-bfbs/time-zone-preference-store";
import { appQueryClient } from "@/infra/query/app-query-client";

const mockBack = jest.fn();
const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockUseChannelDetails = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (href: unknown) => mockPush(href) },
  useLocalSearchParams: () => ({ channelId: "channel-1" }),
  useRouter: () => ({ back: mockBack, navigate: mockNavigate, push: mockPush }),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  PlaySession: { createPlaySession: jest.fn() },
}));

const mockCreatePlaySession = jest.requireMock("@bfbs/common-sdk").PlaySession
  .createPlaySession as jest.Mock;

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("@/features/channel-details/hooks/use-channel-details", () => ({
  useChannelDetails: (channelId: string | undefined) =>
    mockUseChannelDetails(channelId),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ height: 812, width: 375 }),
}));

const SYNOPSIS =
  "A year after their father's funeral, three brothers travel across India by train.";

const loadedChannel = {
  currentProgramme: {
    expirationDateTime: "2026-06-10T14:00:00.000Z",
    id: "programme-1",
    media: [{ type: "image", url: "https://example.test/programme.jpg" }],
    parentalRating: { label: "U" },
    startDateTime: "2026-06-10T13:00:00.000Z",
    synopsis: SYNOPSIS,
    title: "The Darjeeling Express",
  },
  id: "channel-1",
  media: [{ type: "logo", url: "https://example.test/logo.png" }],
  name: "BBC One",
};

afterEach(() => {
  appQueryClient.clear();
});

function renderLoaded() {
  mockUseChannelDetails.mockReturnValue({
    channel: loadedChannel,
    error: null,
    isLoading: false,
  });

  return render(<ChannelDetailsScreen />);
}

describe("<ChannelDetailsScreen />", () => {
  beforeEach(() => {
    resetTimeZonePreference();
    mockBack.mockClear();
    mockNavigate.mockClear();
    mockPush.mockClear();
    mockCreatePlaySession.mockResolvedValue({
      id: "session-1",
      manifestUrl: "https://example.com/live.m3u8",
    });
    mockUseChannelDetails.mockReset();
  });

  test("renders the backdrop and a skeleton while the channel loads", () => {
    mockUseChannelDetails.mockReturnValue({
      channel: null,
      error: null,
      isLoading: true,
    });

    const { getByTestId } = render(<ChannelDetailsScreen />);

    getByTestId("channel-details-background");
    getByTestId("channel-details-skeleton");
  });

  test("shows the unexpected-issue state when the channel fails to load", () => {
    mockUseChannelDetails.mockReturnValue({
      channel: null,
      error: "Request failed",
      isLoading: false,
      refresh: jest.fn(),
    });

    const { getByTestId, getByText } = render(<ChannelDetailsScreen />);

    getByTestId("error-full-screen");
    getByText("Something went wrong");
    getByText("SYS_002");
  });

  test("shows the unreachable-server state when the channel request never lands", () => {
    mockUseChannelDetails.mockReturnValue({
      channel: null,
      error: "Network request failed",
      isLoading: false,
      refresh: jest.fn(),
    });

    const { getByTestId, getByText } = render(<ChannelDetailsScreen />);

    getByText("We're having trouble connecting");
    getByTestId("error-action-back");
  });

  test("takes the reader back from the error state", () => {
    mockUseChannelDetails.mockReturnValue({
      channel: null,
      error: "Request failed",
      isLoading: false,
      refresh: jest.fn(),
    });

    const { getByTestId } = render(<ChannelDetailsScreen />);

    fireEvent.press(getByTestId("error-action-back"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test("renders the hero and the current programme title when loaded", () => {
    const { getByTestId, getByText } = renderLoaded();

    getByTestId("channel-details-screen");
    getByTestId("channel-details-background");
    getByText("The Darjeeling Express");
  });

  test("navigates back from the hero", () => {
    const { getByTestId } = renderLoaded();

    fireEvent.press(getByTestId("channel-details-back"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test("renders the live tag, the on-air window and the age rating", () => {
    const { getByTestId, getByText } = renderLoaded();

    getByTestId("channel-details-metadata");
    getByText("LIVE");
    getByText(/^\d{2}:\d{2} - \d{2}:\d{2}$/);
    getByTestId("age-rating-u");
  });

  test("renders the on-air window in the selected listing time zone", () => {
    setTimeZonePreference(TIME_ZONE_PREFERENCE.UK);

    const { getByText } = renderLoaded();

    getByText("14:00 - 15:00");
  });

  test("renders the synopsis", () => {
    const { getByText } = renderLoaded();

    getByText(SYNOPSIS);
  });

  test("shows the branded placeholder when the programme has no artwork", () => {
    mockUseChannelDetails.mockReturnValue({
      channel: {
        currentProgramme: { id: "programme-1", title: "On Now" },
        id: "channel-1",
        name: "BBC One",
      },
      error: null,
      isLoading: false,
    });

    const { getByTestId } = render(<ChannelDetailsScreen />);

    getByTestId("programme-artwork-fallback-image");
  });

  test("opens the live player from the watch action", async () => {
    const { getByTestId } = renderLoaded();

    fireEvent.press(getByTestId("channel-details-watch-live"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        params: { channelId: "channel-1" },
        pathname: "/player/live/[channelId]",
      });
    });
  });

  test("offers the TV Guide action", () => {
    const { getByTestId, getByText } = renderLoaded();

    getByText("Watch Live");
    getByText("TV Guide");
    expect(
      getByTestId("channel-details-tv-guide").props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  test("opens the guide on this channel", () => {
    const { getByTestId } = renderLoaded();

    fireEvent.press(getByTestId("channel-details-tv-guide"));

    expect(mockNavigate).toHaveBeenCalledWith({
      params: { channelId: "channel-1" },
      pathname: "/tv-guide",
    });
  });

  test("falls back to the channel name and synopsis when off air", () => {
    mockUseChannelDetails.mockReturnValue({
      channel: {
        id: "channel-1",
        name: "BBC One",
        synopsis: "The nation's favourite channel.",
      },
      error: null,
      isLoading: false,
    });

    const { getByText, queryByTestId } = render(<ChannelDetailsScreen />);

    getByText("BBC One");
    getByText("The nation's favourite channel.");
    expect(queryByTestId("channel-details-metadata")).toBeNull();
  });

  test("falls back to the channel tagline when it has no synopsis", () => {
    mockUseChannelDetails.mockReturnValue({
      channel: { id: "channel-1", name: "BBC One", tagline: "Always on." },
      error: null,
      isLoading: false,
    });

    const { getByText } = render(<ChannelDetailsScreen />);

    getByText("Always on.");
  });

  test("swaps the programme in place at the boundary, with no empty flash", () => {
    const onAirWindow = /^\d{2}:\d{2} - \d{2}:\d{2}$/;
    const { getByText, queryByTestId, queryByText, rerender } = renderLoaded();

    getByText("The Darjeeling Express");

    const windowBefore = getByText(onAirWindow).props.children;

    mockUseChannelDetails.mockReturnValue({
      channel: {
        ...loadedChannel,
        currentProgramme: {
          expirationDateTime: "2026-06-10T15:00:00.000Z",
          id: "programme-9",
          media: [],
          startDateTime: "2026-06-10T14:00:00.000Z",
          synopsis: "A later programme.",
          title: "On Next",
        },
      },
      error: null,
      isLoading: false,
    });

    rerender(<ChannelDetailsScreen />);

    getByText("On Next");
    getByText("A later programme.");
    expect(getByText(onAirWindow).props.children).not.toBe(windowBefore);
    expect(queryByText("The Darjeeling Express")).toBeNull();
    expect(queryByTestId("channel-details-skeleton")).toBeNull();
  });
});
