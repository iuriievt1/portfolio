import type { ContentItem } from "@bfbs/common-sdk";
import { Animated, Pressable, type ViewStyle } from "react-native";
import type { TileFormFactor } from "@/features/content-rails/types";
import { HeroCard } from "@/features/hero-carousel/components/hero-card/hero-card";
import { getHeroAccessibilityLabel } from "@/features/hero-carousel/utils/hero-carousel";

// Side cards look the same as the middle one, only faded.
const SIDE_CARD_OPACITY = 0.5;

/** One Hero card at its place in the carousel. Side cards are faded and can't be pressed. */
export function HeroSlide({
  accessible,
  cardNumber,
  formFactor,
  gap,
  isActive,
  isLive,
  item,
  onPress,
  position,
  sizeStyle,
  upcomingLabel,
}: {
  /** False when the carousel itself is the screen reader element. */
  accessible: boolean;
  cardNumber: number;
  formFactor: TileFormFactor;
  /** Space between cards. */
  gap: number;
  isActive: boolean;
  isLive: boolean;
  item: ContentItem;
  onPress?: (() => void) | undefined;
  position: Animated.Value;
  /** Card width. On tablet a layout rule, so it follows the screen during a rotate. */
  sizeStyle: ViewStyle;
  upcomingLabel?: string | undefined;
}) {
  // How many cards this one is from the centre.
  const offset = Animated.add(position, cardNumber);
  // A card gets brighter as it reaches the centre.
  const cardOpacity = offset.interpolate({
    extrapolate: "clamp",
    inputRange: [-1, 0, 1],
    outputRange: [SIDE_CARD_OPACITY, 1, SIDE_CARD_OPACITY],
  });
  // Moves in card widths, so it follows the size layout gives the card.
  const cardShift = offset.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-100%", "100%"],
  });

  return (
    <Animated.View
      // Screen readers only read the current card, not the side cards or repeats.
      accessibilityElementsHidden={!isActive}
      importantForAccessibility={isActive ? "auto" : "no-hide-descendants"}
      // The current card stays in the layout, so the carousel takes its height.
      // Centred by layout, so a card holds its place while the screen turns.
      style={[
        sizeStyle,
        {
          left: "50%",
          position: isActive ? "relative" : "absolute",
          top: 0,
          transform: [
            { translateX: "-50%" },
            { translateX: cardShift },
            { translateX: Animated.multiply(offset, gap) },
          ],
        },
      ]}
    >
      {/* Only the centred card opens; a sideways swipe cancels the press. */}
      <Pressable
        accessible={accessible}
        accessibilityHint={isLive ? "Plays live" : undefined}
        accessibilityLabel={getHeroAccessibilityLabel({
          isLive,
          item,
          upcomingLabel,
        })}
        // A card with nothing to open isn't a button.
        accessibilityRole={onPress ? "button" : undefined}
        disabled={!(isActive && onPress)}
        onPress={onPress}
      >
        <Animated.View style={{ opacity: cardOpacity }}>
          <HeroCard
            formFactor={formFactor}
            isLive={isLive}
            item={item}
            upcomingLabel={upcomingLabel}
            width="100%"
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
