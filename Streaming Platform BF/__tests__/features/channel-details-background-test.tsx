import { render } from "@testing-library/react-native";
import { ChannelDetailsBackground } from "@/features/channel-details/components/channel-details-background/channel-details-background";

const mockIsTablet = jest.fn();
const mockWindow = jest.fn();

jest.mock("@/utils/device-layout", () => ({
  ...jest.requireActual("@/utils/device-layout"),
  isTabletLayout: () => mockIsTablet(),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

function renderBackdropHeight() {
  const { getByTestId } = render(<ChannelDetailsBackground />);

  return getByTestId("channel-details-background").props.style.height;
}

describe("<ChannelDetailsBackground />", () => {
  test("covers the whole window on phones", () => {
    mockIsTablet.mockReturnValue(false);
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    expect(renderBackdropHeight()).toBe(812);
  });

  test("is a band sized to the hero block on tablet portrait", () => {
    mockIsTablet.mockReturnValue(true);
    mockWindow.mockReturnValue({ height: 1180, width: 820 });

    expect(Math.round(renderBackdropHeight())).toBe(374);
  });

  test("is a taller band on tablet landscape", () => {
    mockIsTablet.mockReturnValue(true);
    mockWindow.mockReturnValue({ height: 820, width: 1180 });

    expect(Math.round(renderBackdropHeight())).toBe(464);
  });
});
