import { render } from "@testing-library/react-native";
import { FullGuideScreen } from "@/features/full-guide";

let mockParams: { channelId?: string } = { channelId: "bfbs-sport" };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/features/full-guide", () => ({
  FullGuideScreen: jest.fn(() => null),
}));

const mockFullGuideScreen = FullGuideScreen as unknown as jest.Mock;
const TvGuideScreen = require("@/app/tv-guide/index").default;

function lastGuideProps() {
  return mockFullGuideScreen.mock.calls.at(-1)?.[0];
}

describe("<TvGuideScreen />", () => {
  beforeEach(() => {
    mockFullGuideScreen.mockClear();
    mockParams = { channelId: "bfbs-sport" };
  });

  test("opens the guide on the routed channel", () => {
    render(<TvGuideScreen />);

    expect(lastGuideProps().channelId).toBe("bfbs-sport");
  });

  test("opens the guide without a channel when the link carries none", () => {
    mockParams = {};

    render(<TvGuideScreen />);

    expect(lastGuideProps().channelId).toBeUndefined();
  });
});
