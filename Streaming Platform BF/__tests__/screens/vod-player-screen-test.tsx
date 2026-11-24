import { fireEvent, render } from "@testing-library/react-native";
import { VodPlayer } from "@/features/video-player";

const mockRouterBack = jest.fn();
let mockParams: { id?: string; title?: string } = {
  id: "mock-1",
  title: "Frasier",
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock("@/features/video-player", () => ({
  VodPlayer: jest.fn(() => null),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

const mockVodPlayer = VodPlayer as unknown as jest.Mock;
const VodPlayerScreen = require("@/app/player/vod/[id]").default;

function lastVodPlayerProps() {
  return mockVodPlayer.mock.calls.at(-1)?.[0];
}

describe("<VodPlayerScreen />", () => {
  beforeEach(() => {
    mockRouterBack.mockClear();
    mockVodPlayer.mockClear();
    mockParams = { id: "mock-1", title: "Frasier" };
  });

  test("renders the VOD player for the routed asset", () => {
    render(<VodPlayerScreen />);

    expect(lastVodPlayerProps().asset).toEqual({
      id: "mock-1",
      title: "Frasier",
    });
  });

  test("falls back to the id as the title when none is provided", () => {
    mockParams = { id: "mock-2" };

    render(<VodPlayerScreen />);

    expect(lastVodPlayerProps().asset).toEqual({
      id: "mock-2",
      title: "mock-2",
    });
  });

  test("shows the content-unavailable screen when the id is missing", () => {
    mockParams = {};

    const { getByTestId, getByText } = render(<VodPlayerScreen />);

    expect(mockVodPlayer).not.toHaveBeenCalled();
    getByText("Content Unavailable");

    fireEvent.press(getByTestId("error-action-acknowledge"));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  test("navigates back when the player closes", () => {
    render(<VodPlayerScreen />);

    lastVodPlayerProps().onClose();

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });
});
