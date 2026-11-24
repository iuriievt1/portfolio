import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import HomeIcon from "@/assets/icons/home-icon.svg";
import LiveIcon from "@/assets/icons/live-icon.svg";
import ProfileIcon from "@/assets/icons/profile-icon.svg";
import SearchIcon from "@/assets/icons/search-icon.svg";
import { TabBarTopLine, TabletAwareTabBar } from "@/features/bottom-navigation";
import {
  appContentQueryOptions,
  getInitialAppContentSection,
  getOnNowAppContentSection,
} from "@/features/content-rails/app-content";
import {
  MyBfbsMenuOverlay,
  setMyBfbsMenuOpen,
  useIsMyBfbsMenuOpen,
} from "@/features/my-bfbs";
import { TopNavigationHeader } from "@/features/top-navigation/components/top-navigation-header";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { useGoHomeAfterTimeAway } from "@/hooks/use-go-home-after-time-away";
import { useTabBarSize } from "@/hooks/use-tab-bar-size";
import { featureFlagKeys, useFeatureFlag } from "@/infra/feature-flags";
import { theme } from "@/theme/theme";

const HOME_TAB_FALLBACK_TITLE = "Home";
const ON_NOW_TAB_FALLBACK_TITLE = "On Now";

/** Renders the main tab navigator with SDK-backed labels when available. */
export default function TabsLayout() {
  const { bottomInset, height: tabBarHeight } = useTabBarSize();
  const { isTablet } = useDeviceLayout();
  const isMyBfbsMenuOpen = useIsMyBfbsMenuOpen();
  const { data: appContent, isSuccess } = useQuery(appContentQueryOptions);
  const isMyBfbsEnabled = useFeatureFlag(featureFlagKeys.navbarProfileIcon, {
    fallback: true,
  });
  useGoHomeAfterTimeAway();

  // Sign-out unmounts the tabs; close the menu so it doesn't reopen after sign-in.
  useEffect(() => {
    return () => setMyBfbsMenuOpen(false);
  }, []);

  const homeTitle =
    getInitialAppContentSection(appContent)?.pageCategory.name ??
    HOME_TAB_FALLBACK_TITLE;
  const onNowSection = getOnNowAppContentSection(appContent);
  const onNowOptions = {
    headerShown: false,
    title: onNowSection?.pageCategory.name ?? ON_NOW_TAB_FALLBACK_TITLE,
    tabBarIcon: ({ size, color }: { size: number; color: string }) => (
      <LiveIcon width={size} color={color} />
    ),
    ...(isSuccess && !onNowSection ? { href: null } : {}),
  };
  const myBfbsOptions = {
    headerShown: false,
    title: "My BFBS",
    tabBarIcon: ({ size, color }: { size: number; color: string }) => (
      <ProfileIcon width={size} color={color} />
    ),
    ...(isMyBfbsEnabled ? {} : { href: null }),
  };

  return (
    <>
      <Tabs
        tabBar={(props) => {
          // The phone menu opens over the current tab, so show My BFBS as the open tab.
          const myBfbsIndex = props.state.routes.findIndex(
            (route) => route.name === "my-bfbs",
          );
          const state =
            isMyBfbsMenuOpen && myBfbsIndex !== -1
              ? { ...props.state, index: myBfbsIndex }
              : props.state;

          return <TabletAwareTabBar {...props} state={state} />;
        }}
        screenListeners={({ route }) => ({
          tabPress: (event) => {
            // On phone, My BFBS opens over the current tab instead of switching to it.
            const opensMyBfbsMenu = route.name === "my-bfbs" && !isTablet;
            if (opensMyBfbsMenu) {
              event.preventDefault();
            }
            setMyBfbsMenuOpen(opensMyBfbsMenu);
          },
        })}
        screenOptions={{
          header: () => <TopNavigationHeader />,
          // Hidden tabs skip re-renders, e.g. on rotation.
          freezeOnBlur: true,
          tabBarActiveTintColor: theme.colors.white,
          tabBarInactiveTintColor: theme.colors["grey-50"],
          tabBarLabelStyle: {
            fontFamily: theme.fontFamily["euclid-medium"],
            fontSize: 9,
            lineHeight: 11,
          },
          tabBarLabelPosition: "below-icon",
          tabBarHideOnKeyboard: true,
          tabBarAllowFontScaling: false,
          tabBarBackground: () => <TabBarTopLine />,
          tabBarStyle: {
            backgroundColor: theme.colors["dark-slate-blue"],
            height: tabBarHeight,
            borderTopWidth: 0,
            paddingBottom: bottomInset,
            paddingTop: 6,
          },
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            headerShown: false,
            title: homeTitle,
            tabBarIcon: ({ size, color }) => (
              <HomeIcon width={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="on-now" options={onNowOptions} />
        <Tabs.Screen
          name="search"
          options={{
            headerShown: false,
            title: "Search",
            tabBarIcon: ({ size, color }) => (
              <SearchIcon width={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="my-bfbs" options={myBfbsOptions} />
        <Tabs.Screen
          name="[sectionSlug]"
          options={{
            headerShown: false,
            href: null,
          }}
        />
      </Tabs>
      {isMyBfbsMenuOpen ? (
        <MyBfbsMenuOverlay
          bottomOffset={tabBarHeight}
          onClose={() => setMyBfbsMenuOpen(false)}
        />
      ) : null}
    </>
  );
}
