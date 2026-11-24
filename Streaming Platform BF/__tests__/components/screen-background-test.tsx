import { render } from "@testing-library/react-native";

const mockWindow = jest.fn();

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

const { ScreenBackground } = require("@/components");

describe("<ScreenBackground />", () => {
  test("shows the sign-in photograph on a phone", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByTestId, queryByTestId } = render(<ScreenBackground />);

    getByTestId("screen-background-artwork");
    expect(queryByTestId("screen-background-gradient")).toBeNull();
  });

  test("paints the gradient on a phone when a page carries its own content", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByTestId, queryByTestId } = render(
      <ScreenBackground artwork={false} />,
    );

    getByTestId("screen-background-gradient");
    expect(queryByTestId("screen-background-artwork")).toBeNull();
  });

  test("always paints the gradient on a tablet", () => {
    mockWindow.mockReturnValue({ height: 1180, width: 820 });

    const { getByTestId } = render(<ScreenBackground />);

    getByTestId("screen-background-gradient");
  });
});
