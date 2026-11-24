import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { ParamListBase } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, ScreenBackground, Text } from "@/components";
import {
  getAnalyticsScreen,
  screenChangeTracker,
} from "@/features/analytics/screens/screen-change-tracker";
import { useIsTooManyDevices } from "@/features/auth/auth-session-context";
import { ScrollAwayGradient } from "@/features/watch-details/components/scroll-away-gradient/scroll-away-gradient";
import { useScrollAwayGradient } from "@/features/watch-details/hooks/use-scroll-away-gradient";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { LogoutAction } from "./logout-action";
import { getPageName, MENU_ITEMS, type MenuItem } from "./menu-items";
import { MY_BFBS_PAGES } from "./pages";

const BACK_ICON_SIZE = 20;
const BACK_TOP_INSET = 24;
const PAGE_GAP = 60;
const MENU_WIDTH_LANDSCAPE = 265;
const MENU_WIDTH_PORTRAIT = 220;
const GRADIENT_HEIGHT_LANDSCAPE = 265;
const GRADIENT_HEIGHT_PORTRAIT = 410;

type MyBfbsTabletMenuProps = {
  // No Back when missing, e.g. during AUTH_021.
  onBack?: (() => void) | undefined;
};

export function MyBfbsTabletMenu({ onBack }: MyBfbsTabletMenuProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isLandscape } = useDeviceLayout();
  const { onScroll, opacity } = useScrollAwayGradient();
  const isTooManyDevices = useIsTooManyDevices();
  const [selectedItem, setSelectedItem] = useState<MenuItem>(
    isTooManyDevices ? "Devices" : MENU_ITEMS[0],
  );
  const backTop = insets.top + BACK_TOP_INSET;
  const pageTop = backTop + BACK_ICON_SIZE + PAGE_GAP;

  useEffect(() => {
    const tabs = navigation.getParent<BottomTabNavigationProp<ParamListBase>>();

    return tabs?.addListener("tabPress", () => {
      if (selectedItem === MENU_ITEMS[0]) {
        return;
      }

      setSelectedItem(MENU_ITEMS[0]);
      opacity.setValue(0);
    });
  }, [navigation, opacity, selectedItem]);

  useEffect(() => {
    const trackSelectedPage = () => {
      screenChangeTracker.track(
        getAnalyticsScreen(["my-bfbs", "[page]"], {
          page: getPageName(selectedItem),
        }),
      );
    };

    trackSelectedPage();
    return navigation.addListener("focus", trackSelectedPage);
  }, [navigation, selectedItem]);

  const SelectedPage = MY_BFBS_PAGES[selectedItem];

  const openPage = (item: MenuItem) => {
    if (item === selectedItem) {
      return;
    }

    setSelectedItem(item);
    // Each page opens at the top, so the fade starts hidden.
    opacity.setValue(0);
  };

  return (
    <View className="flex-1">
      <ScreenBackground />
      <View className="flex-1 px-10">
        <View className="flex-1 flex-row gap-4">
          <ScrollView
            className="grow-0"
            contentContainerClassName="gap-[16px] pb-6"
            style={{
              marginTop: pageTop,
              width: isLandscape ? MENU_WIDTH_LANDSCAPE : MENU_WIDTH_PORTRAIT,
            }}
          >
            {MENU_ITEMS.map((item) => {
              const isSelected = item === selectedItem;
              // AUTH_021: only Devices works until a device is removed.
              const isDisabled = isTooManyDevices && item !== "Devices";

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={[
                    "flex-row items-center rounded-full px-[16px] py-[10px]",
                    isSelected ? "bg-transparent-white-10" : "",
                    isDisabled ? "opacity-50" : "",
                  ].join(" ")}
                  disabled={isDisabled}
                  key={item}
                  onPress={() => openPage(item)}
                >
                  <Text className="font-euclid-bold text-[18px] text-white">
                    {item}
                  </Text>
                </Pressable>
              );
            })}
            <LogoutAction variant="tablet" />
          </ScrollView>
          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-6"
            contentContainerStyle={{ paddingTop: pageTop + 10 }}
            key={selectedItem}
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            testID="my-bfbs-tablet-panel"
          >
            <SelectedPage />
          </ScrollView>
        </View>
      </View>
      <ScrollAwayGradient
        height={
          isLandscape ? GRADIENT_HEIGHT_LANDSCAPE : GRADIENT_HEIGHT_PORTRAIT
        }
        opacity={opacity}
      />
      {onBack ? (
        <BackButton
          className="absolute left-10"
          iconHeight={BACK_ICON_SIZE}
          iconWidth={BACK_ICON_SIZE}
          onPress={onBack}
          style={{ top: backTop }}
          testID="my-bfbs-back"
        />
      ) : null}
    </View>
  );
}
