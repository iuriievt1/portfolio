const mockReplace = jest.fn();
const mockSignOut = jest.fn<Promise<void>, []>();
let mockIsTablet = false;

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  useAuthSession: () => ({ signOut: mockSignOut }),
}));

jest.mock("@/infra/error", () => ({
  ...jest.requireActual("@/infra/error"),
  reportError: jest.fn(),
}));

jest.mock("@/hooks/use-device-layout", () => ({
  useDeviceLayout: () => ({
    height: mockIsTablet ? 1180 : 844,
    isLandscape: false,
    isTablet: mockIsTablet,
    width: mockIsTablet ? 820 : 390,
  }),
}));

import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LogoutAction } from "../logout-action";

const initialMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

function renderLogoutAction(variant: "mobile" | "tablet" = "mobile") {
  mockIsTablet = variant === "tablet";

  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <LogoutAction variant={variant} />
    </SafeAreaProvider>,
  );
}

describe("LogoutAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTablet = false;
    mockSignOut.mockResolvedValue();
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});
    jest
      .spyOn(AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["mobile", { maxWidth: 343, minHeight: 249, paddingHorizontal: 26 }],
    ["tablet", { maxWidth: 646, minHeight: 369, paddingHorizontal: 84 }],
  ] as const)("opens the designed confirmation from the %s menu and cancels it", (variant, dialogStyle) => {
    const { getByTestId, getByText, queryByTestId } =
      renderLogoutAction(variant);

    fireEvent.press(getByTestId("logout-action"));
    expect(getByTestId("logout-confirmation-modal")).toBeTruthy();
    expect(getByTestId("logout-confirmation-dialog")).toHaveStyle(dialogStyle);
    expect(
      getByText("Are you sure you want to log out of this device?"),
    ).toBeTruthy();
    expect(getByText("Yes")).toBeTruthy();

    fireEvent.press(getByTestId("logout-cancel"));
    expect(queryByTestId("logout-confirmation-modal")).toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("treats platform back as cancellation", () => {
    const { getByTestId, queryByTestId } = renderLogoutAction();

    fireEvent.press(getByTestId("logout-action"));
    fireEvent(getByTestId("logout-confirmation-native-modal"), "requestClose");

    expect(queryByTestId("logout-confirmation-modal")).toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("logs out once, closes authenticated UI, and returns to home", async () => {
    let resolveSignOut: (() => void) | undefined;
    mockSignOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const { getByTestId, getByText } = renderLogoutAction();

    fireEvent.press(getByTestId("logout-action"));
    fireEvent.press(getByTestId("logout-confirm"));
    fireEvent.press(getByTestId("logout-confirm"));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(getByText("Logging Out…")).toBeTruthy();

    await act(async () => resolveSignOut?.());

    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("keeps confirmation open after failure and allows retry", async () => {
    mockSignOut
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce();
    const { getByTestId, getByText } = renderLogoutAction();

    fireEvent.press(getByTestId("logout-action"));
    fireEvent.press(getByTestId("logout-confirm"));

    expect(
      await waitFor(() =>
        getByText("Sorry, we ran into an unexpected issue. Please try again."),
      ),
    ).toBeTruthy();
    expect(getByTestId("logout-confirmation-modal")).toBeTruthy();

    fireEvent.press(getByTestId("logout-confirm"));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });
});
