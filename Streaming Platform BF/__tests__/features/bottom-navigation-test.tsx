import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { TabletAwareTabBar } from "@/features/bottom-navigation";

let mockIsTablet = true;

jest.mock("@/hooks/use-device-layout", () => ({
  useDeviceLayout: () => ({
    height: 1180,
    isLandscape: false,
    isTablet: mockIsTablet,
    width: 820,
  }),
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  BottomTabBar: () => null,
}));

const tabletTabBarBaseHeight = 58;
const minimumBottomInset = 8;
type HideMyBfbsMode = "none" | "href" | "tabBarItemStyle";

function buildProps(
  bottomInset: number,
  { hideMyBfbsMode = "none" }: { hideMyBfbsMode?: HideMyBfbsMode } = {},
): BottomTabBarProps {
  const routes = [
    { key: "index-1", name: "(home)" },
    { key: "on-now-1", name: "on-now" },
    { key: "search-1", name: "search" },
    { key: "my-bfbs-1", name: "my-bfbs" },
  ];

  const descriptors = {
    "index-1": { options: { title: "Home" } },
    "on-now-1": { options: { title: "On Now" } },
    "search-1": { options: { title: "Search" } },
    "my-bfbs-1": {
      options: {
        title: "My BFBS",
        ...(hideMyBfbsMode === "href" ? { href: null } : {}),
        ...(hideMyBfbsMode === "tabBarItemStyle"
          ? { tabBarItemStyle: { display: "none" as const } }
          : {}),
      },
    },
  };

  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };

  return {
    descriptors,
    insets: { bottom: bottomInset, left: 0, right: 0, top: 0 },
    navigation,
    state: { index: 0, routes },
  } as unknown as BottomTabBarProps;
}

describe("tablet-aware tab bar", () => {
  test("adds the system navigation bar inset as bottom padding on tablet", () => {
    mockIsTablet = true;

    const { getByTestId, getByText } = render(
      <TabletAwareTabBar {...buildProps(48)} />,
    );

    getByText("Home");
    getByText("On Now");
    getByText("Search");
    getByText("My BFBS");

    const style = StyleSheet.flatten(getByTestId("tablet-tab-bar").props.style);

    expect(style.paddingBottom).toBe(48);
    expect(style.minHeight).toBe(tabletTabBarBaseHeight + 48);
  });

  test("falls back to a minimum inset when the device reports none", () => {
    mockIsTablet = true;

    const { getByTestId } = render(<TabletAwareTabBar {...buildProps(0)} />);

    const style = StyleSheet.flatten(getByTestId("tablet-tab-bar").props.style);

    expect(style.paddingBottom).toBe(minimumBottomInset);
    expect(style.minHeight).toBe(tabletTabBarBaseHeight + minimumBottomInset);
  });

  test("delegates to the default tab bar on phones", () => {
    mockIsTablet = false;

    const { queryByTestId } = render(<TabletAwareTabBar {...buildProps(48)} />);

    expect(queryByTestId("tablet-tab-bar")).toBeNull();
  });

  test("hides tabs that Expo Router marks with href null", () => {
    mockIsTablet = true;

    const { queryByText } = render(
      <TabletAwareTabBar {...buildProps(48, { hideMyBfbsMode: "href" })} />,
    );

    expect(queryByText("My BFBS")).toBeNull();
  });

  test("hides tabs that Expo Router rewrites to a hidden tab bar item", () => {
    mockIsTablet = true;

    const { queryByText } = render(
      <TabletAwareTabBar
        {...buildProps(48, { hideMyBfbsMode: "tabBarItemStyle" })}
      />,
    );

    expect(queryByText("My BFBS")).toBeNull();
  });
});
