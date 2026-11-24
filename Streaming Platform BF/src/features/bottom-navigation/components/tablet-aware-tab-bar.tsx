import {
  BottomTabBar,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View } from "react-native";

import HomeIcon from "@/assets/icons/home-icon.svg";
import LiveIcon from "@/assets/icons/live-icon.svg";
import ProfileIcon from "@/assets/icons/profile-icon.svg";
import SearchIcon from "@/assets/icons/search-icon.svg";
import { Text } from "@/components";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { theme } from "@/theme/theme";
import { TabBarTopLine } from "./tab-bar-top-line";

const visibleTabNames = ["(home)", "on-now", "search", "my-bfbs"] as const;
type VisibleTabName = (typeof visibleTabNames)[number];
type TabRoute = BottomTabBarProps["state"]["routes"][number];
type ExpoTabOptions = BottomTabBarProps["descriptors"][string]["options"] & {
  href?: unknown;
};

const tabletTabBarIconSize = 24;
// Top padding plus the icon/label content area system navigation bar inset is added on top of this so the tab content is never squeezed.
const tabletTabBarBaseHeight = 58;

function isVisibleTabRoute(route: TabRoute): route is TabRoute & {
  name: VisibleTabName;
} {
  return visibleTabNames.includes(route.name as VisibleTabName);
}

function isVisibleTabDescriptor({
  descriptors,
  routeKey,
}: {
  descriptors: BottomTabBarProps["descriptors"];
  routeKey: string;
}) {
  const options = descriptors[routeKey]?.options as ExpoTabOptions | undefined;
  const tabBarItemStyle = StyleSheet.flatten(options?.tabBarItemStyle);

  return options?.href !== null && tabBarItemStyle?.display !== "none";
}

function getTabIcon({
  color,
  routeName,
}: {
  color: string;
  routeName: VisibleTabName;
}) {
  switch (routeName) {
    case "(home)":
      return <HomeIcon width={tabletTabBarIconSize} color={color} />;
    case "on-now":
      return <LiveIcon width={tabletTabBarIconSize} color={color} />;
    case "search":
      return <SearchIcon width={tabletTabBarIconSize} color={color} />;
    case "my-bfbs":
      return <ProfileIcon width={tabletTabBarIconSize} color={color} />;
    default:
      return routeName satisfies never;
  }
}

function TabletTabBarItem({
  color,
  isFocused,
  label,
  onPress,
  routeKey,
  routeName,
}: {
  color: string;
  isFocused: boolean;
  label: string;
  onPress: () => void;
  routeKey: string;
  routeName: VisibleTabName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      className="w-20 items-center justify-start"
      key={routeKey}
      onPress={onPress}
    >
      {getTabIcon({ color, routeName })}
      <Text
        className={[
          "mt-1 text-center text-[11px] leading-[14px]",
          isFocused ? "text-white" : "text-grey-50",
        ].join(" ")}
        numberOfLines={1}
        weight="medium"
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Uses the native tab bar on phones and a custom tablet layout that respects
 * tabs hidden via Expo Router, including the runtime `display: none`
 * transformation it applies for `href: null` routes.
 */
export function TabletAwareTabBar({
  descriptors,
  insets,
  navigation,
  state,
}: BottomTabBarProps) {
  const { isTablet } = useDeviceLayout();

  if (!isTablet) {
    return (
      <BottomTabBar
        descriptors={descriptors}
        insets={insets}
        navigation={navigation}
        state={state}
      />
    );
  }

  const visibleRoutes = state.routes.filter(
    (route): route is TabRoute & { name: VisibleTabName } =>
      isVisibleTabRoute(route) &&
      isVisibleTabDescriptor({
        descriptors,
        routeKey: route.key,
      }),
  );
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <View
      className="flex-row justify-between bg-dark-slate-blue pt-2"
      style={{
        minHeight: tabletTabBarBaseHeight + bottomInset,
        paddingBottom: bottomInset,
      }}
      testID="tablet-tab-bar"
    >
      <TabBarTopLine />
      {visibleRoutes.map((route) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) {
          return null;
        }

        const options = descriptor.options;
        const stateIndex = state.routes.findIndex(
          (stateRoute) => stateRoute.key === route.key,
        );
        const isFocused = state.index === stateIndex;
        const color = isFocused ? theme.colors.white : theme.colors["grey-50"];
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : (options.title ?? route.name);

        function handlePress() {
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: "tabPress",
          });

          if (!(isFocused || event.defaultPrevented)) {
            navigation.navigate(route.name);
          }
        }

        return (
          <TabletTabBarItem
            color={color}
            isFocused={isFocused}
            key={route.key}
            label={label}
            onPress={handlePress}
            routeKey={route.key}
            routeName={route.name}
          />
        );
      })}
    </View>
  );
}
