import type { ContentItem } from "@bfbs/common-sdk";
import {
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { Text } from "@/components";
import { useTabBarSize } from "@/hooks/use-tab-bar-size";

const MIN_LIST_HEIGHT = 96;
const ROW_HIT_SLOP = { bottom: 16, left: 8, right: 8, top: 16 };

/** A season's name in the picker, e.g. "Series 2", else its title. */
export function getSeasonLabel(
  season: Pick<ContentItem, "seasonNumber" | "title">,
) {
  return season.seasonNumber ? `Series ${season.seasonNumber}` : season.title;
}

/** The series picker's list, opened over the page below the pill. */
export function SeasonList({
  isTablet,
  onClose,
  onSelect,
  position,
  seasons,
  selectedSeasonId,
}: {
  isTablet: boolean;
  onClose: () => void;
  onSelect: (season: ContentItem) => void;
  position: { left: number; top: number } | null;
  seasons: readonly ContentItem[];
  selectedSeasonId: string;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const { height: tabBarHeight } = useTabBarSize();
  const textSize = isTablet ? "text-[16px]" : "text-[14px]";

  return (
    <Modal
      accessibilityViewIsModal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={["portrait", "landscape"]}
      transparent
      visible={position !== null}
    >
      <Pressable
        accessibilityLabel="Close the series list"
        accessibilityRole="button"
        className="absolute inset-0"
        onPress={onClose}
      />
      {position ? (
        <View
          className={`absolute overflow-hidden rounded-[20px] bg-grey-80 ${
            isTablet ? "w-[140px]" : "w-[114px]"
          }`}
          style={{
            left: position.left,
            maxHeight: Math.max(
              windowHeight - tabBarHeight - position.top,
              MIN_LIST_HEIGHT,
            ),
            top: position.top,
          }}
          testID="season-selector-list"
        >
          <ScrollView
            contentContainerClassName={`items-center gap-8 py-4 ${
              isTablet ? "px-4" : "px-2"
            }`}
          >
            {seasons.map((season) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  selected: season.id === selectedSeasonId,
                }}
                hitSlop={ROW_HIT_SLOP}
                key={season.id}
                onPress={() => onSelect(season)}
                testID={`season-option-${season.id}`}
              >
                <Text
                  className={`text-center text-white ${textSize}`}
                  numberOfLines={1}
                  style={{ includeFontPadding: false }}
                  weight="semibold"
                >
                  {getSeasonLabel(season)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}
