import { ActivityIndicator, View } from "react-native";

import { HOME_SECTION_ROUTE } from "@/features/content-rails/app-content";
import { PageRailsList } from "@/features/content-rails/components/page-rails-list/page-rails-list";
import { useAppContentPage } from "@/features/content-rails/hooks/use-app-content-page";
import { TopNavigationHeader } from "@/features/top-navigation/components/top-navigation-header";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { theme } from "@/theme/theme";

const FINAL_RAIL_PADDING_PHONE = "pb-[26px]";
const FINAL_RAIL_PADDING_TABLET_PORTRAIT = "pb-[25px]";
const FINAL_RAIL_PADDING_TABLET_LANDSCAPE = "pb-[27px]";

function getFinalRailPadding({
  isLandscape,
  isTablet,
}: {
  isLandscape: boolean;
  isTablet: boolean;
}) {
  if (!isTablet) {
    return FINAL_RAIL_PADDING_PHONE;
  }

  return isLandscape
    ? FINAL_RAIL_PADDING_TABLET_LANDSCAPE
    : FINAL_RAIL_PADDING_TABLET_PORTRAIT;
}

/** Renders the first Common SDK section as the Home tab. */
export default function HomeScreen() {
  const { isLandscape, isTablet } = useDeviceLayout();
  const finalRailPadding = getFinalRailPadding({ isLandscape, isTablet });

  const {
    isPending,
    onChannelPress: handleChannelPress,
    onLiveTilePress: handleLiveTilePress,
    onContentTilePress: handleContentTilePress,
    onViewAllPress: handleViewAllPress,
    rails: homeRails,
  } = useAppContentPage(HOME_SECTION_ROUTE);

  if (isPending) {
    return (
      <View
        aria-label="Home loading"
        role="progressbar"
        className="flex-1 items-center justify-center bg-dark-slate-blue"
        testID="home-loading"
      >
        <ActivityIndicator color={theme.colors.white} size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark-slate-blue">
      <PageRailsList
        listProps={{
          contentContainerClassName: finalRailPadding,
          ListHeaderComponent: TopNavigationHeader,
          maintainVisibleContentPosition: { minIndexForVisible: 0 },
        }}
        onChannelPress={handleChannelPress}
        onLiveTilePress={handleLiveTilePress}
        onContentTilePress={handleContentTilePress}
        onViewAllPress={handleViewAllPress}
        railMemoryScope={HOME_SECTION_ROUTE}
        rails={homeRails}
      />
    </View>
  );
}
