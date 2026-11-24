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

import { SignInScreen } from "@/features/auth/components/sign-in-screen";

function renderScreen({ errorMessage }: { errorMessage?: string } = {}) {
  return render(
    <SignInScreen
      errorMessage={errorMessage}
      isSubmitting={false}
      onSubmit={jest.fn()}
    />,
  );
}

describe("<SignInScreen /> on tablet", () => {
  beforeEach(() => {
    mockWindow.mockReturnValue({ height: 1180, width: 820 });
  });

  test("uses the portrait column, button and top offset", () => {
    const { getByTestId } = renderScreen();

    expect(
      StyleSheet.flatten(getByTestId("sign-in-content").props.style),
    ).toMatchObject({ alignSelf: "center", maxWidth: 740 });
    expect(
      StyleSheet.flatten(getByTestId("sign-in-continue").props.style),
    ).toMatchObject({ height: 45, width: 174 });
    expect(
      getByTestId("sign-in-screen").props.contentContainerStyle,
    ).toMatchObject({ paddingHorizontal: 40, paddingTop: 229 });
  });

  test("uses the landscape column, button and top offset", () => {
    mockWindow.mockReturnValue({ height: 820, width: 1180 });

    const { getByTestId } = renderScreen();

    expect(
      StyleSheet.flatten(getByTestId("sign-in-content").props.style),
    ).toMatchObject({ alignSelf: "center", maxWidth: 685 });
    expect(
      StyleSheet.flatten(getByTestId("sign-in-continue").props.style),
    ).toMatchObject({ height: 45, width: 263 });
    expect(
      getByTestId("sign-in-screen").props.contentContainerStyle,
    ).toMatchObject({ paddingHorizontal: 40, paddingTop: 86 });
  });

  test("keeps the same fields and copy as the phone", () => {
    const { getByPlaceholderText, getByText } = renderScreen();

    getByText("Sign In");
    getByText("Please enter your Defence Gateway credentials");
    getByPlaceholderText("Username or Service/Staff Number");
    getByPlaceholderText("Password");
  });
  test("spaces the failed sign-in message the tablet way", () => {
    const { getByTestId, getByText } = renderScreen({
      errorMessage: "Incorrect username or password",
    });

    getByText("Incorrect username or password");
    expect(
      StyleSheet.flatten(getByTestId("sign-in-error").props.style),
    ).toMatchObject({ fontSize: 14, marginTop: 6 });
  });
});
