import { useQuery } from "@tanstack/react-query";
import { type Href, usePathname, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BfbsLogoMobile from "@/assets/images/bfbs-logo-mobile.svg";
import BfbsLogoTabletLandscape from "@/assets/images/bfbs-logo-tablet-landscape.svg";
import BfbsLogoTabletPortrait from "@/assets/images/bfbs-logo-tablet-portrait.svg";
import { Text } from "@/components";
import {
  type AppContent,
  type AppSectionRoute,
  appContentQueryOptions,
  HOME_SECTION_ROUTE,
  ON_NOW_SECTION_ROUTE,
} from "@/features/content-rails/app-content";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import type { TopNavigationItem } from "../types";

type HeaderLayout = "mobile" | "tablet-landscape" | "tablet-portrait";

const headerLayouts = {
  mobile: {
    logo: { height: 36, width: 112 },
    logoMarginBottom: 26,
    navGap: 24,
    // The label's line height.
    navHeight: 20,
    navMarginBottom: 22,
    paddingTop: 22,
    textClassName: "text-[16px] leading-5",
  },
  "tablet-landscape": {
    logo: { height: 63, width: 195 },
    logoMarginBottom: 20,
    navGap: 40,
    navHeight: 22,
    navMarginBottom: 38,
    paddingTop: 24,
    textClassName: "text-[18px] leading-[22px]",
  },
  "tablet-portrait": {
    logo: { height: 56, width: 175 },
    logoMarginBottom: 29,
    navGap: 40,
    navHeight: 22,
    navMarginBottom: 35,
    paddingTop: 24,
    textClassName: "text-[18px] leading-[22px]",
  },
} as const;

const bottomNavigationRoutes = new Set<AppSectionRoute>([
  HOME_SECTION_ROUTE,
  ON_NOW_SECTION_ROUTE,
]);

function isTopNavigationRoute(route: AppSectionRoute): boolean {
  return !bottomNavigationRoutes.has(route);
}

function getTopNavigationItems(
  appContent: AppContent | undefined,
): TopNavigationItem[] {
  return (
    appContent?.sections.flatMap((section) => {
      if (!(isTopNavigationRoute(section.route) && section.pageCategory.name)) {
        return [];
      }

      return [
        {
          id: section.route.slice(1),
          label: section.pageCategory.name,
          path: section.route,
        },
      ];
    }) ?? []
  );
}

function isItemActive(pathname: string, item: TopNavigationItem) {
  if (pathname === item.path) {
    return true;
  }

  return pathname.startsWith(`${item.path}/`);
}

function getLogoComponent({
  isTablet,
  isLandscape,
}: {
  isTablet: boolean;
  isLandscape: boolean;
}) {
  if (!isTablet) {
    return BfbsLogoMobile;
  }

  return isLandscape ? BfbsLogoTabletLandscape : BfbsLogoTabletPortrait;
}

function getHeaderLayout({
  isTablet,
  isLandscape,
}: {
  isTablet: boolean;
  isLandscape: boolean;
}): HeaderLayout {
  if (!isTablet) {
    return "mobile";
  }

  return isLandscape ? "tablet-landscape" : "tablet-portrait";
}

/** The header's full height, so content under it can be sized to fit the screen. */
export function getTopNavigationHeaderHeight({
  isLandscape,
  isTablet,
  topInset,
}: {
  isLandscape: boolean;
  isTablet: boolean;
  topInset: number;
}) {
  const { logo, logoMarginBottom, navHeight, navMarginBottom, paddingTop } =
    headerLayouts[getHeaderLayout({ isTablet, isLandscape })];

  return (
    topInset +
    paddingTop +
    logo.height +
    logoMarginBottom +
    navHeight +
    navMarginBottom
  );
}

/** Renders the SDK-driven top navigation header for tablet and phone layouts. */
export function TopNavigationHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { isLandscape, isTablet } = useDeviceLayout();
  const { data: appContent } = useQuery(appContentQueryOptions);
  const navigationItems = getTopNavigationItems(appContent);
  const headerLayout =
    headerLayouts[getHeaderLayout({ isTablet, isLandscape })];
  const Logo = getLogoComponent({ isTablet, isLandscape });

  function handleNavigationPress(item: TopNavigationItem) {
    if (pathname !== item.path) {
      router.push(item.path as Href);
    }
  }

  return (
    <View
      className="items-center bg-dark-slate-blue px-4"
      style={{
        paddingBottom: headerLayout.navMarginBottom,
        paddingTop: insets.top + headerLayout.paddingTop,
      }}
    >
      <Logo
        accessibilityLabel="BFBS"
        height={headerLayout.logo.height}
        style={{ marginBottom: headerLayout.logoMarginBottom }}
        width={headerLayout.logo.width}
      />

      <View
        className="w-full flex-row items-center justify-center"
        style={{ gap: headerLayout.navGap }}
      >
        {navigationItems.map((item) => {
          const isActive = isItemActive(pathname, item);
          const labelClassName = [
            "text-center",
            isActive ? "text-white" : "text-grey-40",
            headerLayout.textClassName,
          ].join(" ");

          return (
            <Pressable
              accessibilityRole="link"
              accessibilityState={{ selected: isActive }}
              className="min-h-5 max-w-32 items-center"
              hitSlop={10}
              key={item.id}
              onPress={() => handleNavigationPress(item)}
              testID={`top-nav-${item.id}`}
            >
              <Text
                className={labelClassName}
                numberOfLines={1}
                weight="semibold"
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
