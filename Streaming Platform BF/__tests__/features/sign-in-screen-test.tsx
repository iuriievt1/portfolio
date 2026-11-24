import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const mockOpenURL = jest.fn();

jest.mock("expo-linking", () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 47 }),
}));

jest.mock("@/utils/device-layout", () => ({
  ...jest.requireActual("@/utils/device-layout"),
  isTabletLayout: () => false,
}));

import { SignInScreen } from "@/features/auth/components/sign-in-screen";
import { dismissErrorModal, errorModalStore } from "@/infra/error";
import { theme } from "@/theme/theme";

function renderScreen({
  errorMessage,
  isSubmitting = false,
}: {
  errorMessage?: string;
  isSubmitting?: boolean;
} = {}) {
  const onSubmit = jest.fn();
  const view = render(
    <SignInScreen
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
      onSubmit={onSubmit}
    />,
  );

  return { ...view, onSubmit };
}

const RESET_PASSWORD_URL = "https://defence-gateway.example/forgotPassword";

describe("<SignInScreen />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dismissErrorModal();
    process.env.EXPO_PUBLIC_RESET_PASSWORD_URL = RESET_PASSWORD_URL;
    mockOpenURL.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("shows the title, copy and both fields", () => {
    const { getByPlaceholderText, getByText } = renderScreen();

    getByText("Sign In");
    getByText("Please enter your Defence Gateway credentials");
    getByPlaceholderText("Username or Service/Staff Number");
    getByPlaceholderText("Password");
  });

  test("lays the phone screen out to the design", () => {
    const { getByTestId } = renderScreen();

    expect(
      getByTestId("sign-in-screen").props.contentContainerStyle,
    ).toMatchObject({ paddingHorizontal: 16, paddingTop: 78 });
    expect(
      StyleSheet.flatten(getByTestId("sign-in-continue").props.style),
    ).toMatchObject({ height: 42, width: "100%" });
    expect(
      StyleSheet.flatten(
        getByTestId("sign-in-password-visibility").props.style,
      ),
    ).toMatchObject({ height: 48, width: 52 });
  });

  test("hides the password until the visibility button is pressed", () => {
    const { getByLabelText, getByTestId } = renderScreen();

    expect(getByTestId("sign-in-password").props.secureTextEntry).toBe(true);

    fireEvent.press(getByLabelText("Show password"));

    expect(getByTestId("sign-in-password").props.secureTextEntry).toBe(false);

    fireEvent.press(getByLabelText("Hide password"));

    expect(getByTestId("sign-in-password").props.secureTextEntry).toBe(true);
  });

  test("shows on the eye what a tap will do", () => {
    const { getByLabelText, getByTestId, queryByTestId } = renderScreen();

    expect(getByTestId("sign-in-password-show-icon").props.color).toBe(
      theme.colors.white,
    );
    expect(queryByTestId("sign-in-password-hide-icon")).toBeNull();

    fireEvent.press(getByLabelText("Show password"));

    expect(getByTestId("sign-in-password-hide-icon").props.color).toBe(
      theme.colors["transparent-white-60"],
    );
    expect(queryByTestId("sign-in-password-show-icon")).toBeNull();
  });

  test("outlines the field being typed into", () => {
    const { getByTestId } = renderScreen();

    fireEvent(getByTestId("sign-in-username"), "focus");

    expect(getByTestId("sign-in-username").props.className).toContain(
      "border-golden-yellow",
    );

    fireEvent(getByTestId("sign-in-username"), "blur");

    expect(getByTestId("sign-in-username").props.className).toContain(
      "border-transparent-white-10",
    );
  });

  test("submits the typed credentials when Continue is pressed", () => {
    const { getByTestId, onSubmit } = renderScreen();

    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "p@ss word!");
    fireEvent.press(getByTestId("sign-in-continue"));

    expect(onSubmit).toHaveBeenCalledWith({
      password: "p@ss word!",
      username: "user-1",
    });
  });

  test("submits with both fields empty", () => {
    const { getByTestId, onSubmit } = renderScreen();

    fireEvent.press(getByTestId("sign-in-continue"));

    expect(onSubmit).toHaveBeenCalledWith({ password: "", username: "" });
  });

  test("submits from the password field's return key", () => {
    const { getByTestId, onSubmit } = renderScreen();

    fireEvent.changeText(getByTestId("sign-in-username"), "user-1");
    fireEvent.changeText(getByTestId("sign-in-password"), "secret");
    fireEvent(getByTestId("sign-in-password"), "submitEditing");

    expect(onSubmit).toHaveBeenCalledWith({
      password: "secret",
      username: "user-1",
    });
  });

  test("ignores a second press while the first is still in flight", () => {
    const { getByTestId, onSubmit } = renderScreen({ isSubmitting: true });

    fireEvent.press(getByTestId("sign-in-continue"));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("flags both fields and shows the message when sign-in failed", () => {
    const { getByTestId, getByText } = renderScreen({
      errorMessage: "Incorrect username or password",
    });

    getByText("Incorrect username or password");
    expect(
      StyleSheet.flatten(getByTestId("sign-in-error").props.style),
    ).toMatchObject({ fontSize: 14, marginTop: 12 });
    expect(getByTestId("sign-in-username").props.className).toContain(
      "border-red",
    );
    expect(getByTestId("sign-in-password").props.className).toContain(
      "border-red",
    );
  });

  test("keeps the message hidden until a sign-in fails", () => {
    const { queryByTestId } = renderScreen();

    expect(queryByTestId("sign-in-error")).toBeNull();
  });
  test("reads Forgot Password as a link", () => {
    const { getByTestId } = renderScreen();

    expect(getByTestId("sign-in-forgot-password").props.accessibilityRole).toBe(
      "link",
    );
  });

  test("opens the reset page in the browser", async () => {
    const { getByTestId, getByText } = renderScreen();

    getByText("Forgot Password");
    fireEvent.press(getByTestId("sign-in-forgot-password"));

    await waitFor(() => {
      expect(mockOpenURL).toHaveBeenCalledWith(RESET_PASSWORD_URL);
    });
  });

  test("raises the table's dialog when the browser cannot open", async () => {
    mockOpenURL.mockRejectedValue(new Error("No browser"));

    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId("sign-in-forgot-password"));

    await waitFor(() => {
      expect(errorModalStore.getState().code).toBe("SYS_002");
    });
  });
});
