import { ActionScreenEventType, EventType } from "@bfbs/common-sdk";
import type { SynamediaAuthStatus } from "@/features/auth/types";
import { getPageName, MENU_ITEMS } from "@/features/my-bfbs/menu-items";
import { reportError } from "@/infra/error";
import { analyticsManager } from "../analytics-manager";

/** Stable GO Analytics identifiers and readable names for app screens. */
export type AnalyticsScreen = {
  screenId: string;
  screenName: string;
};

/** Screen metadata used while the Mini Guide overlays live playback. */
export const MINI_GUIDE_ANALYTICS_SCREEN: AnalyticsScreen = {
  screenId: "mini-guide",
  screenName: "Mini Guide",
};

/** Screen metadata for live and on-demand playback routes. */
export const PLAYER_ANALYTICS_SCREEN: AnalyticsScreen = {
  screenId: "player",
  screenName: "Player",
};

/** Screen metadata for the My BFBS phone menu when it is open over a tab. */
export const MY_BFBS_ANALYTICS_SCREEN: AnalyticsScreen = {
  screenId: "my-bfbs",
  screenName: "My BFBS",
};

const screens: Record<string, AnalyticsScreen> = {
  home: { screenId: "home", screenName: "Home" },
  "primary-section": {
    screenId: "primary-section",
    screenName: "Section",
  },
  "genre-page": { screenId: "genre-page", screenName: "Genre" },
  "channel-details": {
    screenId: "channel-details",
    screenName: "Channel Details",
  },
  "watch-details": {
    screenId: "watch-details",
    screenName: "Watch Details",
  },
  "collection-page": {
    screenId: "collection-page",
    screenName: "View All",
  },
  "full-guide": { screenId: "full-guide", screenName: "Full Guide" },
  "mini-guide": MINI_GUIDE_ANALYTICS_SCREEN,
  player: PLAYER_ANALYTICS_SCREEN,
  "on-now": { screenId: "on-now", screenName: "On Now" },
  search: { screenId: "search", screenName: "Search" },
  "my-bfbs": MY_BFBS_ANALYTICS_SCREEN,
  "my-bfbs-page": {
    screenId: "my-bfbs-page",
    screenName: "My BFBS Page",
  },
  "sign-in": { screenId: "sign-in", screenName: "Sign In" },
};

const myBfbsPageScreens: Record<string, AnalyticsScreen> = Object.fromEntries(
  MENU_ITEMS.map((pageName) => {
    const page = getPageName(pageName);
    return [page, { screenId: `my-bfbs/${page}`, screenName: pageName }];
  }),
);

/** Resolves Expo Router's file segments to stable analytics screen metadata. */
export function getAnalyticsScreen(
  routeSegments: readonly string[],
  routeParams: {
    page?: string;
    sectionSlug?: string;
    sectionTitle?: string;
  } = {},
): AnalyticsScreen | undefined {
  const segments = routeSegments.filter(
    (segment) => !segment.startsWith("(") && segment !== "index",
  );

  if (segments.length === 0) {
    return screens.home;
  }

  const [first, second] = segments;

  if (first === "player") {
    return screens.player;
  }
  if (first === "tv-guide") {
    return screens["full-guide"];
  }
  if (first === "search") {
    if (second === "show" || second === "watch" || second === "channel") {
      return screens[
        second === "channel" ? "channel-details" : "watch-details"
      ];
    }
    return screens.search;
  }
  if (first === "my-bfbs") {
    if (second === "show" || second === "watch") {
      return screens["watch-details"];
    }
    if (second === "[page]") {
      return (
        myBfbsPageScreens[routeParams.page ?? ""] ?? screens["my-bfbs-page"]
      );
    }
    return second ? screens["my-bfbs-page"] : screens["my-bfbs"];
  }
  if (first === "on-now") {
    if (second === "show" || second === "watch") {
      return screens["watch-details"];
    }
    if (second === "channel") {
      return screens["channel-details"];
    }
    if (second === "view-all") {
      return screens["collection-page"];
    }
    return screens["on-now"];
  }
  if (first === "genre" || (first === "[sectionSlug]" && second === "genre")) {
    return screens["genre-page"];
  }
  if (
    first === "channel" ||
    (first === "[sectionSlug]" && second === "channel")
  ) {
    return screens["channel-details"];
  }
  if (
    first === "show" ||
    first === "watch" ||
    (first === "[sectionSlug]" && (second === "show" || second === "watch"))
  ) {
    return screens["watch-details"];
  }
  if (
    first === "view-all" ||
    (first === "[sectionSlug]" && second === "view-all")
  ) {
    return screens["collection-page"];
  }
  if (first === "[sectionSlug]") {
    const sectionSlug = routeParams.sectionSlug;
    if (!sectionSlug) {
      return screens["primary-section"];
    }

    const sectionName =
      routeParams.sectionTitle ??
      sectionSlug
        .split("-")
        .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
        .join(" ");

    return {
      screenId: `primary-section/${sectionSlug}`,
      screenName: `Section: ${sectionName}`,
    };
  }

  return undefined;
}

/** Resolves the active route or phone My BFBS menu to screen metadata. */
export function getRouteAnalyticsScreen(
  routeSegments: readonly string[],
  routeParams: {
    page?: string;
    sectionSlug?: string;
    sectionTitle?: string;
  } = {},
  isMyBfbsMenuOpen = false,
): AnalyticsScreen | undefined {
  return isMyBfbsMenuOpen
    ? MY_BFBS_ANALYTICS_SCREEN
    : getAnalyticsScreen(routeSegments, routeParams);
}

/** Resolves app-owned auth gate views to their analytics screen. */
export function getAuthAnalyticsScreen(
  authStatus: SynamediaAuthStatus,
): AnalyticsScreen | undefined {
  if (
    authStatus === "signed-out" ||
    authStatus === "opening-browser" ||
    authStatus === "waiting-for-approval" ||
    authStatus === "bootstrapping" ||
    authStatus === "bootstrap-error" ||
    authStatus === "denied" ||
    authStatus === "expired" ||
    authStatus === "error"
  ) {
    return screens["sign-in"];
  }
  if (authStatus === "too-many-devices") {
    return myBfbsPageScreens.devices;
  }

  return undefined;
}

/** Tracks screen transitions once and preserves the required event order. */
export class ScreenChangeTracker {
  private currentScreen: AnalyticsScreen | undefined;

  constructor(
    private readonly publish: (event: {
      data: {
        eventType: ActionScreenEventType;
        screenId: string;
        screenName: string;
      };
      type: EventType.ACTION_SCREEN_CHANGE;
    }) => void,
  ) {}

  private publishSafely(event: {
    data: {
      eventType: ActionScreenEventType;
      screenId: string;
      screenName: string;
    };
    type: EventType.ACTION_SCREEN_CHANGE;
  }) {
    try {
      this.publish(event);
    } catch {
      try {
        reportError(new Error("Screen analytics event failed"), {
          tags: { area: "analytics", operation: "screen_change" },
        });
      } catch {
        // Analytics failures must not interrupt navigation or rendering.
      }
    }
  }

  /** Publishes DISMISSED before LOADED, suppressing duplicate screen updates. */
  track(nextScreen: AnalyticsScreen | undefined) {
    if (!nextScreen) {
      if (this.currentScreen) {
        this.publishSafely({
          type: EventType.ACTION_SCREEN_CHANGE,
          data: {
            eventType: ActionScreenEventType.DISMISSED,
            ...this.currentScreen,
          },
        });
        this.currentScreen = undefined;
      }
      return;
    }

    if (this.currentScreen?.screenId === nextScreen.screenId) {
      // Dynamic section names can arrive after the route. Keep the latest
      // metadata for a later dismissal without emitting another screen visit.
      this.currentScreen = nextScreen;
      return;
    }

    if (this.currentScreen) {
      this.publishSafely({
        type: EventType.ACTION_SCREEN_CHANGE,
        data: {
          eventType: ActionScreenEventType.DISMISSED,
          ...this.currentScreen,
        },
      });
    }

    this.currentScreen = nextScreen;
    this.publishSafely({
      type: EventType.ACTION_SCREEN_CHANGE,
      data: {
        eventType: ActionScreenEventType.LOADED,
        ...nextScreen,
      },
    });
  }
}

/** Shared screen transition tracker for router and in-player screens. */
export const screenChangeTracker = new ScreenChangeTracker((event) =>
  analyticsManager.track(event),
);
