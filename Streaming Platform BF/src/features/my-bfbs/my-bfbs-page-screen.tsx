import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import backgroundSource from "@/assets/images/my-bfbs-background-mobile.png";
import { BackButton } from "@/components";
import { ScrollAwayGradient } from "@/features/watch-details/components/scroll-away-gradient/scroll-away-gradient";
import { useScrollAwayGradient } from "@/features/watch-details/hooks/use-scroll-away-gradient";
import { SwipeRowArea } from "./components/swipe-row";
import type { MenuItem } from "./menu-items";
import { MY_BFBS_PAGES } from "./pages";

const BACK_ICON_SIZE = 20;
const BACK_TOP_INSET = 16;
// Space between Back and the page.
const PAGE_GAP = 60;
// Dark fade over the page as it scrolls up under Back.
const GRADIENT_HEIGHT = 277;

type MyBfbsPageScreenProps = {
  item: MenuItem;
  // No Back when missing, e.g. during AUTH_021.
  onBack?: (() => void) | undefined;
};

/** Full-screen My BFBS page on phone, with Back above the page content. */
export function MyBfbsPageScreen({ item, onBack }: MyBfbsPageScreenProps) {
  const insets = useSafeAreaInsets();
  const { onScroll, opacity } = useScrollAwayGradient();
  const Page = MY_BFBS_PAGES[item];
  const backTop = insets.top + BACK_TOP_INSET;

  return (
    <View className="flex-1 bg-black">
      {/* The glow image is see-through, so the black shows around it. */}
      <Image
        contentFit="cover"
        pointerEvents="none"
        source={backgroundSource}
        style={StyleSheet.absoluteFill}
      />
      {/* Starts at the screen top so the page scrolls up under the fade. */}
      <SwipeRowArea>
        <ScrollView
          contentContainerClassName="px-4 pb-6"
          contentContainerStyle={{
            paddingTop: backTop + BACK_ICON_SIZE + PAGE_GAP,
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Page />
        </ScrollView>
      </SwipeRowArea>
      <ScrollAwayGradient height={GRADIENT_HEIGHT} opacity={opacity} />
      {onBack ? (
        <BackButton
          className="absolute left-4"
          iconHeight={BACK_ICON_SIZE}
          iconWidth={BACK_ICON_SIZE}
          onPress={onBack}
          style={{ top: backTop }}
          testID="my-bfbs-page-back"
        />
      ) : null}
    </View>
  );
}
