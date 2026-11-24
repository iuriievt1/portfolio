import type { ContentItem } from "@bfbs/common-sdk";
import { Pressable } from "react-native";
import ChevronDownIcon from "@/assets/icons/chevron-down-icon.svg";
import { Text } from "@/components";
import {
  getSeasonLabel,
  SeasonList,
} from "@/features/watch-details/components/season-selector/season-list";
import { useDropdownPosition } from "@/features/watch-details/components/season-selector/use-dropdown-position";
import { theme } from "@/theme/theme";

const CHEVRON_HEIGHT = 16;
const CHEVRON_WIDTH = 20;
const LIST_GAP = 16;

/** The "Series N" pill that opens the list of the show's seasons. */
export function SeasonSelector({
  isTablet = false,
  onSelect,
  seasons,
  selectedSeason,
}: {
  isTablet?: boolean;
  onSelect: (season: ContentItem) => void;
  seasons: readonly ContentItem[];
  selectedSeason: ContentItem;
}) {
  const { anchorRef, close, isOpen, open, position } = useDropdownPosition({
    gap: LIST_GAP,
  });
  const label = getSeasonLabel(selectedSeason);
  const textSize = isTablet ? "text-[16px]" : "text-[14px]";

  const handleSelect = (season: ContentItem) => {
    close();
    onSelect(season);
  };

  return (
    <>
      <Pressable
        accessibilityHint="Opens the list of series"
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        className={`flex-row items-center justify-center self-start rounded-full bg-grey-80 ${
          isTablet
            ? "h-[38px] w-[140px] gap-1 px-4"
            : "h-[34px] w-[114px] gap-1 px-2"
        }`}
        onPress={open}
        ref={anchorRef}
        testID="season-selector"
      >
        <Text
          className={`w-[68px] text-center text-white ${textSize}`}
          // A long season title ends in "…" inside the 68px label.
          numberOfLines={1}
          style={{ includeFontPadding: false }}
          weight="semibold"
        >
          {label}
        </Text>
        <ChevronDownIcon
          color={theme.colors.white}
          height={CHEVRON_HEIGHT}
          style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
          width={CHEVRON_WIDTH}
        />
      </Pressable>
      <SeasonList
        isTablet={isTablet}
        onClose={close}
        onSelect={handleSelect}
        position={position}
        seasons={seasons}
        selectedSeasonId={selectedSeason.id}
      />
    </>
  );
}
