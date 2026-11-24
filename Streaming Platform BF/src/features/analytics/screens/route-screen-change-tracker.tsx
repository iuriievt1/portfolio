import { useQuery } from "@tanstack/react-query";
import { useGlobalSearchParams, useSegments } from "expo-router";
import { useEffect } from "react";
import {
  appContentQueryOptions,
  getAppContentNavigationTitle,
} from "@/features/content-rails/app-content";
import { useIsMyBfbsMenuOpen } from "@/features/my-bfbs";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import {
  getRouteAnalyticsScreen,
  screenChangeTracker,
} from "./screen-change-tracker";

/** Tracks route and phone My BFBS screens without rerendering the auth gate. */
export function RouteScreenChangeTracker() {
  const routeSegments = useSegments();
  const { page, sectionSlug } = useGlobalSearchParams<{
    page?: string;
    sectionSlug?: string;
  }>();
  const isMyBfbsMenuOpen = useIsMyBfbsMenuOpen();
  const { isTablet } = useDeviceLayout();
  const { data: appContent } = useQuery(appContentQueryOptions);
  const sectionTitle = sectionSlug
    ? getAppContentNavigationTitle(appContent, `/${sectionSlug}`)
    : undefined;

  useEffect(() => {
    // LivePlayerScreen owns Player/Mini Guide transitions and channel changes.
    if (
      routeSegments.some((segment) => segment === "player") &&
      routeSegments.some((segment) => segment === "live") &&
      !isMyBfbsMenuOpen
    ) {
      return;
    }

    // The tablet menu reports its selected page, including its initial page.
    const routePathSegments = routeSegments.filter(
      (segment) => !segment.startsWith("(") && String(segment) !== "index",
    );
    if (
      isTablet &&
      routePathSegments.length === 1 &&
      routePathSegments[0] === "my-bfbs"
    ) {
      return;
    }

    screenChangeTracker.track(
      getRouteAnalyticsScreen(
        routeSegments,
        {
          ...(page === undefined ? {} : { page }),
          ...(sectionSlug === undefined ? {} : { sectionSlug }),
          ...(sectionTitle === undefined ? {} : { sectionTitle }),
        },
        isMyBfbsMenuOpen,
      ),
    );
  }, [
    isMyBfbsMenuOpen,
    isTablet,
    page,
    routeSegments,
    sectionSlug,
    sectionTitle,
  ]);

  return null;
}
