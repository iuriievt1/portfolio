import { ActionScreenEventType, EventType } from "@bfbs/common-sdk";
import {
  getAnalyticsScreen,
  getAuthAnalyticsScreen,
  getRouteAnalyticsScreen,
  ScreenChangeTracker,
} from "../screen-change-tracker";

const mockReportError = jest.fn();

jest.mock("@/infra/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock("@bfbs/common-sdk", () => ({
  ActionScreenEventType: { DISMISSED: "DISMISSED", LOADED: "LOADED" },
  EventType: { ACTION_SCREEN_CHANGE: "ACTION_SCREEN_CHANGE" },
}));

describe("getAnalyticsScreen", () => {
  it.each([
    [["(tabs)", "(home)", "index"], "home"],
    [["(tabs)", "(home)", "genre", "[categoryId]"], "genre-page"],
    [["(tabs)", "[sectionSlug]", "genre", "[categoryId]"], "genre-page"],
    [["(tabs)", "search", "watch", "[assetId]"], "watch-details"],
    [["(tabs)", "on-now", "index"], "on-now"],
    [["(tabs)", "on-now", "channel", "[channelId]"], "channel-details"],
    [["(tabs)", "on-now", "show", "[assetId]"], "watch-details"],
    [["(tabs)", "on-now", "watch", "[assetId]"], "watch-details"],
    [["(tabs)", "on-now", "view-all", "[collectionId]"], "collection-page"],
    [["(tabs)", "search"], "search"],
    [["(tabs)", "search", "show", "[assetId]"], "watch-details"],
    [["(tabs)", "search", "channel", "[channelId]"], "channel-details"],
    [["(tabs)", "my-bfbs", "watch", "[assetId]"], "watch-details"],
    [["(tabs)", "my-bfbs"], "my-bfbs"],
    [["(tabs)", "view-all", "[collectionId]"], "collection-page"],
    [["tv-guide", "index"], "full-guide"],
    [["player", "live", "[channelId]"], "player"],
    [["player", "vod", "[assetId]"], "player"],
    [["(tabs)", "my-bfbs", "[page]"], "my-bfbs-page"],
  ])("maps route segments %j to %s", (segments, expectedScreenId) => {
    expect(getAnalyticsScreen(segments)?.screenId).toBe(expectedScreenId);
  });

  it("does not track unknown routes", () => {
    expect(getAnalyticsScreen(["(tabs)", "unknown-route"])).toBeUndefined();
  });

  it("tracks My BFBS destinations as distinct screens", () => {
    expect(
      getAnalyticsScreen(["(tabs)", "my-bfbs", "[page]"], {
        page: "my-list",
      }),
    ).toEqual({ screenId: "my-bfbs/my-list", screenName: "My List" });
    expect(
      getAnalyticsScreen(["(tabs)", "my-bfbs", "[page]"], {
        page: "continue-watching",
      }),
    ).toEqual({
      screenId: "my-bfbs/continue-watching",
      screenName: "Continue Watching",
    });
  });

  it("tracks primary sections with route-aware screen IDs", () => {
    const bfbsExtra = getAnalyticsScreen(["(tabs)", "[sectionSlug]"], {
      sectionSlug: "bfbs-extra",
    });
    const sport = getAnalyticsScreen(["(tabs)", "[sectionSlug]"], {
      sectionSlug: "sport",
    });

    expect(bfbsExtra).toEqual({
      screenId: "primary-section/bfbs-extra",
      screenName: "Section: Bfbs Extra",
    });
    expect(sport?.screenId).toBe("primary-section/sport");
    expect(sport?.screenId).not.toBe(bfbsExtra?.screenId);
  });

  it("uses the loaded navigation title when it is available", () => {
    expect(
      getAnalyticsScreen(["(tabs)", "[sectionSlug]"], {
        sectionSlug: "bfbs-extra",
        sectionTitle: "BFBS Extra",
      }),
    ).toEqual({
      screenId: "primary-section/bfbs-extra",
      screenName: "Section: BFBS Extra",
    });
  });

  it("reports the phone My BFBS menu and restores the route when closed", () => {
    expect(
      getRouteAnalyticsScreen(["(tabs)", "(home)", "index"], {}, true),
    ).toEqual({ screenId: "my-bfbs", screenName: "My BFBS" });
    expect(
      getRouteAnalyticsScreen(["(tabs)", "(home)", "index"], {}, false),
    ).toEqual({ screenId: "home", screenName: "Home" });
  });

  it("maps the auth gate's signed-out view to Sign In", () => {
    expect(getAuthAnalyticsScreen("signed-out")).toEqual({
      screenId: "sign-in",
      screenName: "Sign In",
    });
  });

  it("maps the too-many-devices auth view to the Devices destination", () => {
    expect(getAuthAnalyticsScreen("too-many-devices")).toEqual({
      screenId: "my-bfbs/devices",
      screenName: "Devices",
    });
  });

  it("leaves device-removal state without an active app screen", () => {
    expect(getAuthAnalyticsScreen("device-removed")).toBeUndefined();
  });

  it.each([
    "opening-browser",
    "waiting-for-approval",
    "bootstrapping",
    "bootstrap-error",
    "denied",
    "expired",
    "error",
  ] as const)("keeps Sign In active during %s", (status) => {
    expect(getAuthAnalyticsScreen(status)).toEqual({
      screenId: "sign-in",
      screenName: "Sign In",
    });
  });
});

describe("ScreenChangeTracker", () => {
  it("dismisses the current screen before loading the next and ignores duplicates", () => {
    const publish = jest.fn();
    const tracker = new ScreenChangeTracker(publish);
    const home = { screenId: "home", screenName: "Home" };
    const search = { screenId: "search", screenName: "Search" };

    tracker.track(home);
    tracker.track(search);
    tracker.track(search);

    expect(publish.mock.calls.map(([event]) => event)).toEqual([
      {
        type: EventType.ACTION_SCREEN_CHANGE,
        data: { eventType: ActionScreenEventType.LOADED, ...home },
      },
      {
        type: EventType.ACTION_SCREEN_CHANGE,
        data: { eventType: ActionScreenEventType.DISMISSED, ...home },
      },
      {
        type: EventType.ACTION_SCREEN_CHANGE,
        data: { eventType: ActionScreenEventType.LOADED, ...search },
      },
    ]);
  });

  it("dismisses the active screen when leaving for an untracked route", () => {
    const publish = jest.fn();
    const tracker = new ScreenChangeTracker(publish);
    const home = { screenId: "home", screenName: "Home" };

    tracker.track(home);
    tracker.track(undefined);
    tracker.track(undefined);

    expect(publish.mock.calls.map(([event]) => event.data.eventType)).toEqual([
      ActionScreenEventType.LOADED,
      ActionScreenEventType.DISMISSED,
    ]);
  });

  it("updates the name of the same screen without emitting another visit", () => {
    const publish = jest.fn();
    const tracker = new ScreenChangeTracker(publish);
    const fallback = {
      screenId: "primary-section/bfbs-extra",
      screenName: "Section: Bfbs Extra",
    };
    const titled = { ...fallback, screenName: "Section: BFBS Extra" };

    tracker.track(fallback);
    tracker.track(titled);
    tracker.track(undefined);

    expect(publish.mock.calls.map(([event]) => event.data)).toEqual([
      { eventType: ActionScreenEventType.LOADED, ...fallback },
      { eventType: ActionScreenEventType.DISMISSED, ...titled },
    ]);
  });

  it("keeps screen changes safe when analytics publishing throws", () => {
    const tracker = new ScreenChangeTracker(() => {
      throw new Error("EventBus unavailable");
    });

    expect(() =>
      tracker.track({ screenId: "home", screenName: "Home" }),
    ).not.toThrow();
    expect(() =>
      tracker.track({ screenId: "search", screenName: "Search" }),
    ).not.toThrow();
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Screen analytics event failed" }),
      { tags: { area: "analytics", operation: "screen_change" } },
    );
  });
});
