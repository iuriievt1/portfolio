import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTileFormFactor } from "@/features/content-rails/utils/tile-metrics";
import { HERO_CARD_LAYOUT } from "@/features/hero-carousel/components/hero-card/hero-card";
import { HeroDots } from "@/features/hero-carousel/components/hero-dots/hero-dots";
import { HeroSlide } from "@/features/hero-carousel/components/hero-slide/hero-slide";
import { useHeroSwipe } from "@/features/hero-carousel/hooks/use-hero-swipe";
import {
  getHeroAccessibilityLabel,
  getHeroCardWidth,
  getItemIndex,
  HERO_CARD_GAP,
  type HeroItem,
  TABLET_CARD_MAX_WIDTH,
  TABLET_CARD_SIZE_STYLE,
} from "@/features/hero-carousel/utils/hero-carousel";
import { getTopNavigationHeaderHeight } from "@/features/top-navigation/components/top-navigation-header";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { useTabBarSize } from "@/hooks/use-tab-bar-size";

const SIDE_CARDS = 2;
// Same as the mt-4 above the first rail.
const HERO_TOP_GAP = 16;
// Keeps the card's bottom clear of the tab bar.
const HERO_BOTTOM_GAP = 16;
const HERO_ACCESSIBILITY_ACTIONS: AccessibilityActionInfo[] = [
  { name: "activate" },
  { name: "decrement" },
  { name: "increment" },
];

/** The page's Hero items in an endless loop, one card per swipe. */
export function HeroCarousel({
  className = "",
  items,
}: {
  className?: string;
  items: HeroItem[];
}) {
  const {
    height: screenHeight,
    isLandscape,
    isTablet,
    width: screenWidth,
  } = useDeviceLayout();
  const { top: topInset } = useSafeAreaInsets();
  const { height: tabBarHeight } = useTabBarSize();
  const formFactor = getTileFormFactor({ isLandscape, isTablet });
  // A tablet card shrinks to fit between the header and the tab bar, e.g. a short tablet in landscape.
  // Fits the landscape height in both orientations, so a rotate can't leave a stale cap.
  const maxCardHeight =
    Math.min(screenWidth, screenHeight) -
    getTopNavigationHeaderHeight({ isLandscape: true, isTablet, topInset }) -
    HERO_TOP_GAP -
    HERO_BOTTOM_GAP -
    tabBarHeight;
  const fitWidth = maxCardHeight * HERO_CARD_LAYOUT[formFactor].aspectRatio;
  const designWidth = getHeroCardWidth(formFactor, screenWidth);
  // Still needed in JS for the swipe distance.
  const cardWidth = isTablet ? Math.min(designWidth, fitWidth) : designWidth;
  // Layout sizes the tablet card; the fit only lowers its max.
  const cardSizeStyle: ViewStyle = isTablet
    ? {
        ...TABLET_CARD_SIZE_STYLE,
        maxWidth: Math.min(TABLET_CARD_MAX_WIDTH, fitWidth),
      }
    : { width: cardWidth };
  const itemSize = cardWidth + HERO_CARD_GAP[formFactor];
  const isLooping = items.length > 1;
  const { activeCard, isSettling, panHandlers, position, settle } =
    useHeroSwipe({ isLooping, itemSize });

  if (items.length === 0) {
    return null;
  }

  const currentIndex = getItemIndex(activeCard, items.length);
  const currentItem = items[currentIndex];

  const handleAccessibilityAction = ({
    nativeEvent,
  }: AccessibilityActionEvent) => {
    if (isSettling) {
      return;
    }

    switch (nativeEvent.actionName) {
      case "activate":
        currentItem?.onPress?.();
        break;
      case "decrement":
        settle(-1);
        break;
      case "increment":
        settle(1);
        break;
    }
  };

  // The accessibility props are only present when there are several items, so screen readers don't read the carousel when it can't move.
  const accessibilityProps = isLooping
    ? {
        accessible: true,
        accessibilityActions: HERO_ACCESSIBILITY_ACTIONS,
        accessibilityHint: currentItem?.isLive ? "Plays live" : undefined,
        accessibilityLabel: "Featured",
        accessibilityRole: "adjustable" as const,
        accessibilityValue: {
          text: `${currentItem ? getHeroAccessibilityLabel(currentItem) : ""}, ${currentIndex + 1} of ${items.length}`,
        },
        onAccessibilityAction: handleAccessibilityAction,
      }
    : {};

  const cardNumbers = isLooping
    ? Array.from(
        { length: SIDE_CARDS * 2 + 1 },
        (_, index) => activeCard - SIDE_CARDS + index,
      )
    : [activeCard];

  return (
    <View className={className} {...accessibilityProps} {...panHandlers}>
      {cardNumbers.map((cardNumber) => {
        const heroItem = items[getItemIndex(cardNumber, items.length)];

        if (!heroItem) {
          return null;
        }

        return (
          <HeroSlide
            key={cardNumber}
            accessible={!isLooping}
            cardNumber={cardNumber}
            formFactor={formFactor}
            gap={HERO_CARD_GAP[formFactor]}
            isActive={cardNumber === activeCard}
            isLive={heroItem.isLive}
            item={heroItem.item}
            onPress={heroItem.onPress}
            upcomingLabel={heroItem.upcomingLabel}
            position={position}
            sizeStyle={cardSizeStyle}
          />
        );
      })}
      {formFactor === "phone" && isLooping ? (
        <HeroDots activeCard={activeCard} position={position} />
      ) : null}
    </View>
  );
}
