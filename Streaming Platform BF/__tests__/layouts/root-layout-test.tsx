import { render, waitFor } from "@testing-library/react-native";
import { trackAppStart } from "@/features/analytics/app-analytics";
import { configureCommonSdk } from "@/infra/common-sdk";
import { reportError } from "@/infra/error";
import { initFeatureFlags } from "@/infra/feature-flags";

jest.mock("react-native/src/private/animated/NativeAnimatedHelper");
jest.mock("../../global.css", () => ({}));

const mockBootstrapSession = jest.fn();
const mockGetPage = jest.fn();
const mockGetNavigation = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  Auth: {
    bootstrapSession: mockBootstrapSession,
  },
  ContentCatalogue: {
    getAllChannels: jest.fn(() => Promise.resolve([])),
    getPage: mockGetPage,
    getNavigation: mockGetNavigation,
    getProgrammeGuide: jest.fn(() =>
      Promise.resolve({ channels: [], totalChannels: 0 }),
    ),
  },
  ContentCategoryTemplate: {
    HERO: "HERO",
    SIXTEEN_BY_NINE_DESIGNED_LARGE: "SIXTEEN_BY_NINE_DESIGNED_LARGE",
    SIXTEEN_BY_NINE_DESIGNED_SMALL: "SIXTEEN_BY_NINE_DESIGNED_SMALL",
    SIXTEEN_BY_NINE_LARGE: "SIXTEEN_BY_NINE_LARGE",
    SIXTEEN_BY_NINE_STANDARD: "SIXTEEN_BY_NINE_STANDARD",
    SQUARE_LARGE: "SQUARE_LARGE",
    SQUARE_SMALL: "SQUARE_SMALL",
  },
  isDeviceNotRegisteredError: () => false,
}));

jest.mock("@/infra/common-sdk", () => ({
  configureCommonSdk: jest.fn(),
}));

jest.mock("@/features/analytics/app-analytics", () => ({
  trackAppStart: jest.fn(),
}));

jest.mock("expo-network", () => ({
  addNetworkStateListener: () => ({ remove: jest.fn() }),
  getNetworkStateAsync: async () => ({
    isConnected: true,
    isInternetReachable: true,
  }),
}));

jest.mock("@/infra/app-version/use-app-update-error", () => ({
  useAppUpdateError: () => {},
}));

jest.mock("@/infra/feature-flags", () => ({
  initFeatureFlags: jest.fn(),
}));

jest.mock("expo-font", () => ({
  useFonts: () => [true],
}));

jest.mock("expo-router", () => {
  const MockStack = () => {
    const { Text } = require("react-native");

    return <Text testID="app-stack">App Stack</Text>;
  };

  MockStack.Screen = () => null;
  MockStack.Protected = ({
    children,
    guard,
  }: {
    children?: React.ReactNode;
    guard: boolean;
  }) => (guard ? children : null);

  return {
    Stack: MockStack,
    useNavigationContainerRef: () => ({ current: {} }),
    usePathname: () => "/",
  };
});

jest.mock("expo-splash-screen", () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-device", () => ({
  DeviceType: {
    PHONE: "phone",
    TABLET: "tablet",
  },
  deviceType: "phone",
}));

jest.mock("expo-screen-orientation", () => ({
  OrientationLock: {
    LANDSCAPE: "landscape",
    PORTRAIT_UP: "portrait-up",
  },
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/features/splash-screen", () => ({
  ...jest.requireActual("@/features/splash-screen"),
  SplashScreen: () => {
    const { Text } = require("react-native");

    return <Text>In App Splash Screen</Text>;
  },
  useSplashScreen: () => {
    const { Animated } = require("react-native");

    return {
      isSplashVisible: true,
      splashOpacity: new Animated.Value(1),
    };
  },
}));

jest.mock("@/features/auth", () => ({
  SynamediaAuthGate: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock("@/infra/error", () => ({
  ...jest.requireActual("@/infra/error"),
  reportError: jest.fn(),
}));

describe("<RootLayout />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(configureCommonSdk).mockResolvedValue(undefined);
    jest.mocked(initFeatureFlags).mockResolvedValue(undefined);
    mockBootstrapSession.mockResolvedValue(undefined);
    mockGetNavigation.mockResolvedValue({
      category: { id: "root", name: "Root", type: "navigation" },
      children: [],
    });
    mockGetPage.mockResolvedValue({
      category: { id: "empty", name: "Empty", type: "category_list" },
      rails: [],
    });
  });

  afterEach(() => {
    const { appQueryClient } = require("@/infra/query/app-query-client");

    appQueryClient.clear();
  });

  test("shows the in-app splash screen on app launch", async () => {
    const { RootLayout } = require("../../src/app/_layout");
    const { toJSON } = render(<RootLayout />);
    const tree = toJSON();

    expect(tree).toMatchInlineSnapshot(`
      <View
        className="flex-1 bg-black"
      >
        <View
          className="absolute inset-0"
          collapsable={false}
          style={
            {
              "opacity": 1,
            }
          }
        >
          <Text>
            In App Splash Screen
          </Text>
        </View>
      </View>
    `);

    await waitFor(() => {
      expect(configureCommonSdk).toHaveBeenCalledTimes(1);
      expect(initFeatureFlags).toHaveBeenCalledTimes(1);
      expect(trackAppStart).toHaveBeenCalledTimes(1);
    });
  });

  test("shows the app shell while Home content warms in the background", async () => {
    jest.mocked(configureCommonSdk).mockResolvedValue(undefined);
    jest.mocked(initFeatureFlags).mockResolvedValue(undefined);

    let resolveHomePage: (value: unknown) => void = () => {};
    const homePagePromise = new Promise((resolve) => {
      resolveHomePage = resolve;
    });

    mockGetNavigation.mockResolvedValue({
      category: { id: "root", name: "Root", type: "navigation" },
      children: [
        {
          category: { id: "Home", name: "Home", type: "category_list" },
        },
      ],
    });
    mockGetPage.mockImplementation(() => homePagePromise);

    const { RootLayout } = require("../../src/app/_layout");
    const { getByTestId, queryByTestId } = render(<RootLayout />);

    await waitFor(() => {
      expect(getByTestId("app-stack")).toBeTruthy();
      expect(mockBootstrapSession).not.toHaveBeenCalled();
      expect(mockGetPage).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: "Home" }),
      );
    });

    expect(queryByTestId("app-stack")).toBeTruthy();

    resolveHomePage({
      category: { id: "Home", name: "Home", type: "category_list" },
      rails: [
        {
          category: { id: "home-rail", name: "Featured", type: "rail" },
          items: [{ contentType: "standalone", id: "vod-1", title: "VOD" }],
          template: "SIXTEEN_BY_NINE_STANDARD",
        },
      ],
    });

    await waitFor(() => {
      expect(getByTestId("app-stack")).toBeTruthy();
    });
  });

  test("does not fail app startup when Home content preload is unauthorized", async () => {
    const error = new Error("Synamedia Go request failed with 401");
    mockGetNavigation.mockRejectedValue(error);

    const { RootLayout } = require("../../src/app/_layout");
    const { getByTestId, queryByText } = render(<RootLayout />);

    await waitFor(() => {
      expect(mockBootstrapSession).not.toHaveBeenCalled();
      expect(mockGetNavigation).toHaveBeenCalledTimes(1);
      expect(getByTestId("app-stack")).toBeTruthy();
    });

    expect(queryByText("Unable to start BFBS")).toBeNull();
    expect(reportError).toHaveBeenCalledWith(error, {
      tags: {
        area: "startup",
        operation: "preload_initial_home_content",
      },
    });
  });

  test("does not fail app startup when analytics throws", async () => {
    const error = new Error("Analytics failed");
    jest.mocked(trackAppStart).mockImplementationOnce(() => {
      throw error;
    });

    const { RootLayout } = require("../../src/app/_layout");
    const { getByTestId, queryByText } = render(<RootLayout />);

    await waitFor(() => {
      expect(getByTestId("app-stack")).toBeTruthy();
    });

    expect(queryByText("Unable to start BFBS")).toBeNull();
    expect(reportError).toHaveBeenCalledWith(error, {
      tags: { area: "startup", operation: "track_app_start" },
    });
  });
});
