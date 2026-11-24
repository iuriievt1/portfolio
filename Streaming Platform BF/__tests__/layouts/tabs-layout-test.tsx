import { useQuery } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { useFeatureFlag } from "@/infra/feature-flags";

type TabScreenOptions = {
  href?: null;
  title?: string;
} & Record<string, unknown>;

type TabScreenProps = {
  name: string;
  options?: TabScreenOptions;
};

const mockTabsScreen = jest.fn<void, [TabScreenProps]>();

jest.mock("expo-router", () => {
  const MockTabs = ({ children }: { children?: ReactNode }) => children;

  MockTabs.Screen = (props: TabScreenProps) => {
    mockTabsScreen(props);
    return null;
  };

  return {
    Tabs: MockTabs,
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

jest.mock("@/features/bottom-navigation", () => ({
  TabletAwareTabBar: () => null,
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  queryOptions: jest.fn((options) => options),
  useQuery: jest.fn(),
}));

jest.mock("@/features/top-navigation/components/top-navigation-header", () => ({
  TopNavigationHeader: () => null,
}));

jest.mock("@/hooks/use-go-home-after-time-away", () => ({
  useGoHomeAfterTimeAway: jest.fn(),
}));

jest.mock("@/infra/feature-flags", () => ({
  featureFlagKeys: {
    navbarProfileIcon: "ui.navbarProfileIcon",
  },
  useFeatureFlag: jest.fn(() => true),
}));

describe("TabsLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useFeatureFlag).mockReturnValue(true);
    jest.mocked(useQuery).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useQuery>);
  });

  it("keeps the My BFBS tab visible when the feature flag is enabled", () => {
    const TabsLayout = require("../../src/app/(tabs)/_layout").default;

    render(<TabsLayout />);

    const myBfbsProps = mockTabsScreen.mock.calls
      .map(([props]) => props)
      .find((props) => props.name === "my-bfbs");

    expect(myBfbsProps).toBeDefined();
    expect(myBfbsProps?.options).not.toHaveProperty("href");
  });

  it("hides the My BFBS tab when the feature flag is disabled", () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    const TabsLayout = require("../../src/app/(tabs)/_layout").default;

    render(<TabsLayout />);

    const myBfbsProps = mockTabsScreen.mock.calls
      .map(([props]) => props)
      .find((props) => props.name === "my-bfbs");

    expect(myBfbsProps).toBeDefined();
    expect(myBfbsProps?.options?.href).toBeNull();
  });

  it("uses Common SDK navigation labels for visible content tabs", () => {
    jest.mocked(useQuery).mockReturnValue({
      data: {
        navigation: {
          category: { id: "root", name: "Root" },
          children: [
            { category: { id: "Home", name: "Home Summary" } },
            { category: { id: "sdk-live", name: "Live Summary" } },
            { category: { id: "sdk-sport", name: "SDK Sport" } },
          ],
          id: "root",
          name: "Root",
        },
        sections: [
          {
            navigationItem: { id: "Home", name: "Home Summary" },
            pageCategory: { id: "Home", name: "Home from SDK" },
            rails: [],
            route: "/",
          },
          {
            navigationItem: { id: "sdk-live", name: "Live Summary" },
            pageCategory: { id: "sdk-live", name: "Live TV" },
            rails: [],
            route: "/on-now",
          },
          {
            navigationItem: { id: "sdk-sport", name: "SDK Sport" },
            pageCategory: { id: "sdk-sport", name: "Sport Page" },
            rails: [],
            route: "/sport",
          },
        ],
      },
    } as ReturnType<typeof useQuery>);
    const TabsLayout = require("../../src/app/(tabs)/_layout").default;

    render(<TabsLayout />);

    const screens = mockTabsScreen.mock.calls.map(([props]) => props);

    expect(
      screens.find((props) => props.name === "(home)")?.options?.title,
    ).toBe("Home from SDK");
    expect(
      screens.find((props) => props.name === "on-now")?.options?.title,
    ).toBe("Live TV");
    expect(screens.find((props) => props.name === "[sectionSlug]")).toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ href: null }),
      }),
    );
  });

  it("hides the live tab when Common SDK navigation has no live page", () => {
    jest.mocked(useQuery).mockReturnValue({
      data: {
        navigation: {
          category: { id: "root", name: "Root" },
          children: [{ category: { id: "Home", name: "Home Summary" } }],
        },
        sections: [
          {
            navigationItem: { id: "Home", name: "Home Summary" },
            pageCategory: { id: "Home", name: "Home from SDK" },
            rails: [],
            route: "/",
          },
          {
            navigationItem: { id: "sdk-whats-on", name: "What's On" },
            pageCategory: { id: "sdk-whats-on", name: "What's On" },
            rails: [],
            route: "/whats-on",
          },
        ],
      },
      isSuccess: true,
    } as ReturnType<typeof useQuery>);
    const TabsLayout = require("../../src/app/(tabs)/_layout").default;

    render(<TabsLayout />);

    const onNowProps = mockTabsScreen.mock.calls
      .map(([props]) => props)
      .find((props) => props.name === "on-now");

    expect(onNowProps?.options?.href).toBeNull();
  });

  it("keeps the live tab visible while navigation is still loading", () => {
    jest.mocked(useQuery).mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as ReturnType<typeof useQuery>);
    const TabsLayout = require("../../src/app/(tabs)/_layout").default;

    render(<TabsLayout />);

    const onNowProps = mockTabsScreen.mock.calls
      .map(([props]) => props)
      .find((props) => props.name === "on-now");

    expect(onNowProps?.options).not.toHaveProperty("href");
  });

  it("keeps static tab labels while navigation is unavailable", () => {
    jest.mocked(useQuery).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useQuery>);
    const TabsLayout = require("../../src/app/(tabs)/_layout").default;

    render(<TabsLayout />);

    const screens = mockTabsScreen.mock.calls.map(([props]) => props);

    expect(
      screens.find((props) => props.name === "(home)")?.options?.title,
    ).toBe("Home");
    expect(
      screens.find((props) => props.name === "on-now")?.options?.title,
    ).toBe("On Now");
  });

  it("lets the Search stack own header visibility", () => {
    const TabsLayout = require("../../src/app/(tabs)/_layout").default;

    render(<TabsLayout />);

    const searchProps = mockTabsScreen.mock.calls
      .map(([props]) => props)
      .find((props) => props.name === "search");

    expect(searchProps?.options?.headerShown).toBe(false);
  });
});
