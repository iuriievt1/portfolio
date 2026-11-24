jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  usePlaybackAuthorization: () => async () => true,
}));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ChannelDetailsScreen } from "@/features/channel-details/channel-details-screen";
import { appQueryClient } from "@/infra/query/app-query-client";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUseChannelDetails = jest.fn();
const mockWindow = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (href: unknown) => mockPush(href) },
  useLocalSearchParams: () => ({ channelId: "channel-1" }),
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  PlaySession: { createPlaySession: jest.fn() },
}));

const mockCreatePlaySession = jest.requireMock("@bfbs/common-sdk").PlaySession
  .createPlaySession as jest.Mock;

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 24 }),
}));

jest.mock("@/features/channel-details/hooks/use-channel-details", () => ({
  useChannelDetails: (channelId: string | undefined) =>
    mockUseChannelDetails(channelId),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

const CHANNEL = {
  currentProgramme: {
    expirationDateTime: "2026-06-10T14:00:00.000Z",
    id: "programme-1",
    parentalRating: { label: "U" },
    startDateTime: "2026-06-10T13:00:00.000Z",
    synopsis: "Three brothers travel across India by train.",
    title: "The Darjeeling Express",
  },
  id: "channel-1",
  media: [{ type: "logo", url: "https://example.test/logo.png" }],
  name: "BBC One",
};

afterEach(() => {
  appQueryClient.clear();
});

function renderTablet({ height, width }: { height: number; width: number }) {
  mockWindow.mockReturnValue({ height, width });
  mockUseChannelDetails.mockReturnValue({
    channel: CHANNEL,
    error: null,
    isLoading: false,
  });

  return render(<ChannelDetailsScreen />);
}

describe("<ChannelDetailsScreen /> on tablet", () => {
  test("shapes the skeleton like the tablet hero, so nothing jumps", () => {
    mockWindow.mockReturnValue({ height: 1180, width: 820 });
    mockUseChannelDetails.mockReturnValue({
      channel: null,
      error: null,
      isLoading: true,
    });

    const { getByTestId } = render(<ChannelDetailsScreen />);

    expect(
      getByTestId("channel-details-skeleton-artwork").props.style,
    ).toMatchObject({ width: 362 });
  });

  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockCreatePlaySession.mockResolvedValue({
      id: "session-1",
      manifestUrl: "https://example.com/live.m3u8",
    });
    mockUseChannelDetails.mockReset();
    mockWindow.mockReset();
  });

  test("lays the hero out with the designed portrait metrics", () => {
    const { getByLabelText, getByTestId } = renderTablet({
      height: 1180,
      width: 820,
    });

    expect(getByTestId("channel-details-background").props.style.height).toBe(
      374,
    );
    expect(getByLabelText("Watch Live").props.style.width).toBe(174);
    expect(getByTestId("channel-details-artwork").props.style.width).toBe(362);
    expect(
      getByTestId("channel-details-channel-logo").props.style,
    ).toMatchObject({ height: 60, right: 40, top: 17, width: 60 });
    expect(getByTestId("channel-details-back").props.style).toMatchObject({
      paddingLeft: 40,
    });
    expect(getByTestId("channel-details-hero-row").props.style).toMatchObject({
      alignItems: "flex-start",
      gap: 14,
      marginTop: 38,
    });
    expect(
      getByTestId("channel-details-hero-column").props.style,
    ).toMatchObject({ justifyContent: "flex-start" });
  });

  test("widens the hero in landscape", () => {
    const { getByLabelText, getByTestId } = renderTablet({
      height: 820,
      width: 1180,
    });

    expect(getByTestId("channel-details-background").props.style.height).toBe(
      464,
    );
    expect(getByLabelText("Watch Live").props.style.width).toBe(263);
    expect(getByTestId("channel-details-artwork").props.style.width).toBe(472);
    expect(
      Math.round(
        getByTestId("channel-details-artwork").props.style.height as number,
      ),
    ).toBe(266);
    expect(
      getByTestId("channel-details-channel-logo").props.style,
    ).toMatchObject({ height: 85, right: 40, top: 17, width: 85 });
    expect(getByTestId("channel-details-hero-row").props.style).toMatchObject({
      alignItems: "flex-start",
      gap: 14,
      marginTop: 54,
    });
    const column = getByTestId("channel-details-hero-column").props.style;

    expect(column.justifyContent).toBe("center");
    expect(Math.round(column.minHeight as number)).toBe(266);
  });

  test("keeps the live metadata and navigation working", () => {
    const { getByTestId, getByText } = renderTablet({
      height: 1180,
      width: 820,
    });

    getByTestId("channel-details-metadata");
    getByText("The Darjeeling Express");
    getByText("Three brothers travel across India by train.");

    fireEvent.press(getByTestId("channel-details-back"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test("keeps the buttons inside the artwork when the title is long", () => {
    mockWindow.mockReturnValue({ height: 1180, width: 820 });
    mockUseChannelDetails.mockReturnValue({
      channel: {
        ...CHANNEL,
        currentProgramme: {
          ...CHANNEL.currentProgramme,
          title: "Couples Come Dine with Me and Friends of the Family",
        },
      },
      error: null,
      isLoading: false,
    });

    const { getByTestId, getByText } = render(<ChannelDetailsScreen />);
    const artworkHeight = getByTestId("channel-details-artwork").props.style
      .height as number;

    expect(Math.round(artworkHeight)).toBe(204);
    expect(
      getByText("Couples Come Dine with Me and Friends of the Family").props
        .numberOfLines,
    ).toBe(1);
  });

  test("opens the live player from the tablet watch action", async () => {
    const { getByTestId } = renderTablet({ height: 1180, width: 820 });

    fireEvent.press(getByTestId("channel-details-watch-live"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        params: { channelId: "channel-1" },
        pathname: "/player/live/[channelId]",
      });
    });
  });
});
