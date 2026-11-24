import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const mockWindow = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 24 }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

jest.mock("@/utils/device-layout", () => ({
  ...jest.requireActual("@/utils/device-layout"),
  isTabletLayout: () => true,
}));

import { SignInDisclaimer } from "@/features/auth/components/sign-in-disclaimer";

function renderDisclaimer() {
  return render(<SignInDisclaimer onContinue={jest.fn()} />);
}

describe("<SignInDisclaimer /> on tablet", () => {
  beforeEach(() => {
    mockWindow.mockReturnValue({ height: 1180, width: 820 });
  });

  test("paints the gradient backdrop instead of the phone artwork", () => {
    const { getByTestId, queryByTestId } = renderDisclaimer();

    getByTestId("screen-background-gradient");
    expect(queryByTestId("screen-background-artwork")).toBeNull();
  });

  test("shows the same title and copy as the phone", () => {
    const { getByText } = renderDisclaimer();

    getByText("Before you sign in");
    getByText("Only entitled BFBS users can access this service.");
    getByText("Access is monitored to ensure authorised and legitimate use.");
    getByText("Suspected misuse will be investigated and acted upon.");
  });

  test("uses the portrait button and title sizes", () => {
    const { getByTestId, getByText } = renderDisclaimer();

    const button = StyleSheet.flatten(
      getByTestId("sign-in-disclaimer-continue").props.style,
    );
    const title = StyleSheet.flatten(
      getByText("Before you sign in").props.style,
    );

    expect(button).toMatchObject({ width: 174 });
    expect(title).toMatchObject({ fontSize: 28 });
  });

  test("widens the button in landscape", () => {
    mockWindow.mockReturnValue({ height: 820, width: 1180 });

    const { getByTestId } = renderDisclaimer();

    const button = StyleSheet.flatten(
      getByTestId("sign-in-disclaimer-continue").props.style,
    );

    expect(button).toMatchObject({ width: 263 });
  });

  test("centres the content instead of pinning it to a screen size", () => {
    const { getByTestId } = renderDisclaimer();

    expect(
      getByTestId("sign-in-disclaimer").props.contentContainerStyle,
    ).toMatchObject({
      flexGrow: 1,
      justifyContent: "center",
      paddingTop: 64,
    });

    expect(
      StyleSheet.flatten(getByTestId("sign-in-disclaimer-content").props.style),
    ).toMatchObject({ alignSelf: "center", maxWidth: 741 });
  });
});
