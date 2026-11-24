import { fireEvent, render } from "@testing-library/react-native";

import MyBfbsScreen from "@/app/(tabs)/my-bfbs";
import { AuthSessionContext } from "@/features/auth/auth-session-context";
import { MyBfbsTabletMenu } from "@/features/my-bfbs";

let mockIsTablet = false;
const mockTrackScreenChange = jest.fn();
const mockNavigationListeners: Record<string, () => void> = {};
const mockAddNavigationListener = jest.fn(
  (event: string, listener: () => void) => {
    mockNavigationListeners[event] = listener;
    return jest.fn();
  },
);

jest.mock("@/hooks/use-device-layout", () => ({
  useDeviceLayout: () => ({
    height: 1180,
    isLandscape: false,
    isTablet: mockIsTablet,
    width: 820,
  }),
}));

jest.mock("@/features/auth/auth-session-context", () => ({
  ...jest.requireActual("@/features/auth/auth-session-context"),
  useAuthSession: () => ({ signOut: jest.fn() }),
}));

jest.mock("@/features/analytics/screens/screen-change-tracker", () => ({
  ...jest.requireActual("@/features/analytics/screens/screen-change-tracker"),
  screenChangeTracker: {
    track: (...args: unknown[]) => mockTrackScreenChange(...args),
  },
}));

jest.mock("expo-router", () => ({
  useNavigation: () => ({
    addListener: (...args: [string, () => void]) =>
      mockAddNavigationListener(...args),
    getParent: () => undefined,
  }),
  useRouter: () => ({
    back: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

// Keeps the AUTH_021 test on the menu, not the device list.
jest.mock("@/features/my-bfbs/pages/devices-page", () => ({
  DevicesPage: () => null,
}));

jest.mock("@/features/my-bfbs/pages/my-list-page", () => ({
  MyListPage: () => null,
}));

describe("MyBfbsScreen", () => {
  beforeEach(() => {
    mockTrackScreenChange.mockClear();
    mockAddNavigationListener.mockClear();
    for (const event of Object.keys(mockNavigationListeners)) {
      delete mockNavigationListeners[event];
    }
  });

  it("shows the phone menu on phone", () => {
    mockIsTablet = false;
    const { getByTestId, getByText } = render(<MyBfbsScreen />);

    expect(getByText("Welcome to my BFBS hub")).toBeTruthy();
    expect(getByTestId("my-bfbs-close")).toBeTruthy();
  });

  it("shows the side menu and page panel on tablet", () => {
    mockIsTablet = true;
    const { getByTestId } = render(<MyBfbsScreen />);

    expect(getByTestId("my-bfbs-back")).toBeTruthy();
    expect(getByTestId("my-bfbs-tablet-panel")).toBeTruthy();
  });

  it("tracks tablet My BFBS page changes", () => {
    mockIsTablet = true;
    const { getByRole } = render(<MyBfbsScreen />);

    expect(mockTrackScreenChange).toHaveBeenLastCalledWith({
      screenId: "my-bfbs/help",
      screenName: "Help",
    });

    fireEvent.press(getByRole("button", { name: "My List" }));

    expect(mockTrackScreenChange).toHaveBeenCalledWith({
      screenId: "my-bfbs/my-list",
      screenName: "My List",
    });
  });

  it("re-tracks the selected tablet page after returning from a detail route", () => {
    mockIsTablet = true;
    const { getByRole } = render(<MyBfbsScreen />);
    fireEvent.press(getByRole("button", { name: "My List" }));
    mockTrackScreenChange.mockClear();
    mockTrackScreenChange({
      screenId: "watch-details",
      screenName: "Watch Details",
    });

    mockNavigationListeners.focus?.();

    expect(mockTrackScreenChange).toHaveBeenLastCalledWith({
      screenId: "my-bfbs/my-list",
      screenName: "My List",
    });
  });

  it("re-tracks the selected tablet page when its tab regains focus", () => {
    mockIsTablet = true;
    const { getByRole } = render(<MyBfbsScreen />);
    fireEvent.press(getByRole("button", { name: "My List" }));
    mockTrackScreenChange.mockClear();
    mockTrackScreenChange({ screenId: "home", screenName: "Home" });

    mockNavigationListeners.focus?.();

    expect(mockTrackScreenChange).toHaveBeenLastCalledWith({
      screenId: "my-bfbs/my-list",
      screenName: "My List",
    });
  });

  it("in AUTH_021 opens on Devices and disables the other items on tablet", () => {
    mockIsTablet = true;
    const { getByRole, queryByTestId } = render(
      <AuthSessionContext
        value={{
          checkAuthenticatedDevice: async () => false,
          isTooManyDevices: true,
          signOut: jest.fn(),
        }}
      >
        <MyBfbsTabletMenu />
      </AuthSessionContext>,
    );

    const devices = getByRole("button", { name: "Devices" });
    expect(devices).toBeSelected();
    expect(devices).not.toBeDisabled();
    expect(getByRole("button", { name: "Help" })).toBeDisabled();
    expect(getByRole("button", { name: "My List" })).toBeDisabled();
    expect(queryByTestId("my-bfbs-back")).toBeNull();
  });
});
