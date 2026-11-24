import { fireEvent, render } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: "opened" })),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 47 }),
}));

jest.mock("@/utils/device-layout", () => ({
  ...jest.requireActual("@/utils/device-layout"),
  isTabletLayout: () => false,
}));

import {
  SignInDisclaimer,
  TERMS_AND_CONDITIONS_URL,
} from "@/features/auth/components/sign-in-disclaimer";

const mockWebBrowser = WebBrowser as jest.Mocked<typeof WebBrowser>;

describe("<SignInDisclaimer />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows the agreed title and copy over the phone artwork", () => {
    const { getByTestId, getByText } = render(
      <SignInDisclaimer onContinue={jest.fn()} />,
    );

    getByTestId("screen-background-artwork");
    getByText("Before you sign in");
    getByText("Only entitled BFBS users can access this service.");
    getByText("Access is monitored to ensure authorised and legitimate use.");
    getByText("Suspected misuse will be investigated and acted upon.");
  });

  test("continues to sign-in when Continue is pressed", () => {
    const onContinue = jest.fn();
    const { getByTestId } = render(
      <SignInDisclaimer onContinue={onContinue} />,
    );

    fireEvent.press(getByTestId("sign-in-disclaimer-continue"));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  test("opens the terms in the browser", () => {
    const { getByTestId } = render(<SignInDisclaimer onContinue={jest.fn()} />);

    fireEvent.press(getByTestId("sign-in-disclaimer-terms"));

    expect(mockWebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      TERMS_AND_CONDITIONS_URL,
    );
  });
});
