import { act, render } from "@testing-library/react-native";
import { RouteScreenChangeTracker } from "../route-screen-change-tracker";

const mockTrackScreen = jest.fn();
let mockAppContent: unknown;
let mockRouteSegments: string[] = ["(tabs)", "(home)", "index"];
let mockRouteParams: Record<string, string> = {};
let mockIsMyBfbsMenuOpen = false;
let mockIsTablet = false;

jest.mock("expo-router", () => ({
  useGlobalSearchParams: () => mockRouteParams,
  useSegments: () => mockRouteSegments,
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: () => ({ data: mockAppContent }),
}));

jest.mock("@/features/my-bfbs", () => ({
  useIsMyBfbsMenuOpen: () => mockIsMyBfbsMenuOpen,
}));

jest.mock("@/hooks/use-device-layout", () => ({
  useDeviceLayout: () => ({ isTablet: mockIsTablet }),
}));

jest.mock("../screen-change-tracker", () => ({
  ...jest.requireActual("../screen-change-tracker"),
  screenChangeTracker: {
    track: (...args: unknown[]) => mockTrackScreen(...args),
  },
}));

describe("RouteScreenChangeTracker", () => {
  beforeEach(() => {
    mockTrackScreen.mockClear();
    mockAppContent = undefined;
    mockRouteSegments = ["(tabs)", "(home)", "index"];
    mockRouteParams = {};
    mockIsMyBfbsMenuOpen = false;
    mockIsTablet = false;
  });

  it("uses the loaded title for a dynamic navigation section", () => {
    mockRouteSegments = ["(tabs)", "[sectionSlug]"];
    mockRouteParams = { sectionSlug: "bfbs-extra" };
    mockAppContent = {
      sections: [
        { route: "/bfbs-extra", pageCategory: { name: "BFBS Extra" } },
      ],
    };

    render(<RouteScreenChangeTracker />);

    expect(mockTrackScreen).toHaveBeenCalledWith({
      screenId: "primary-section/bfbs-extra",
      screenName: "Section: BFBS Extra",
    });
  });

  it("updates a dynamic section title after loading without retracking the screen", () => {
    mockRouteSegments = ["(tabs)", "[sectionSlug]"];
    mockRouteParams = { sectionSlug: "bfbs-extra" };

    const { rerender } = render(<RouteScreenChangeTracker />);

    expect(mockTrackScreen).toHaveBeenCalledTimes(1);
    expect(mockTrackScreen).toHaveBeenLastCalledWith({
      screenId: "primary-section/bfbs-extra",
      screenName: "Section: Bfbs Extra",
    });

    mockAppContent = {
      sections: [
        { route: "/bfbs-extra", pageCategory: { name: "BFBS Extra" } },
      ],
    };
    rerender(<RouteScreenChangeTracker />);

    expect(mockTrackScreen).toHaveBeenCalledTimes(2);
    expect(mockTrackScreen).toHaveBeenLastCalledWith({
      screenId: "primary-section/bfbs-extra",
      screenName: "Section: BFBS Extra",
    });
  });

  it("tracks the phone My BFBS menu and restores the current route on close", () => {
    const { rerender } = render(<RouteScreenChangeTracker />);
    expect(mockTrackScreen).toHaveBeenLastCalledWith({
      screenId: "home",
      screenName: "Home",
    });

    act(() => {
      mockIsMyBfbsMenuOpen = true;
    });
    rerender(<RouteScreenChangeTracker />);
    expect(mockTrackScreen).toHaveBeenLastCalledWith({
      screenId: "my-bfbs",
      screenName: "My BFBS",
    });

    act(() => {
      mockIsMyBfbsMenuOpen = false;
    });
    rerender(<RouteScreenChangeTracker />);
    expect(mockTrackScreen).toHaveBeenLastCalledWith({
      screenId: "home",
      screenName: "Home",
    });
  });

  it("leaves live player transitions to the player tracker", () => {
    mockRouteSegments = ["player", "live", "[channelId]"];
    mockRouteParams = { channelId: "channel-1" };
    const { rerender } = render(<RouteScreenChangeTracker />);

    expect(mockTrackScreen).not.toHaveBeenCalled();

    mockRouteParams = { channelId: "channel-2" };
    rerender(<RouteScreenChangeTracker />);

    expect(mockTrackScreen).not.toHaveBeenCalled();
  });

  it("tracks VOD player routes", () => {
    mockRouteSegments = ["player", "vod", "[id]"];
    mockRouteParams = { id: "asset-1" };

    render(<RouteScreenChangeTracker />);

    expect(mockTrackScreen).toHaveBeenCalledWith({
      screenId: "player",
      screenName: "Player",
    });
  });

  it("leaves the tablet My BFBS root route to its selected-page tracker", () => {
    mockIsTablet = true;
    mockRouteSegments = ["(tabs)", "my-bfbs", "index"];

    render(<RouteScreenChangeTracker />);

    expect(mockTrackScreen).not.toHaveBeenCalled();
  });
});
