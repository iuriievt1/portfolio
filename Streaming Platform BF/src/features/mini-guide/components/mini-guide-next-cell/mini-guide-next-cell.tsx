import { View } from "react-native";
import { MISSING_PROGRAMME_LABEL } from "@/utils/programme";
import { MINI_GUIDE_DIMENSIONS } from "../../constants";
import type { MiniGuideProgramme, MiniGuideVariant } from "../../types";
import { formatProgrammeMetadata } from "../../utils/format-programme-time";
import { MiniGuideProgrammeDetails } from "../mini-guide-programme-details/mini-guide-programme-details";

type MiniGuideNextCellProps = {
  isFocused: boolean;
  isLongTitle: boolean;
  programme: MiniGuideProgramme | null;
  timeZone: string | undefined;
  variant: MiniGuideVariant;
};

export function MiniGuideNextCell({
  isFocused,
  isLongTitle,
  programme,
  timeZone,
  variant,
}: MiniGuideNextCellProps) {
  const dimensions = MINI_GUIDE_DIMENSIONS[variant];
  const metadata = programme
    ? formatProgrammeMetadata(programme, timeZone)
    : "";
  const showDescription =
    isFocused && dimensions.showDescription && Boolean(programme?.description);

  if (dimensions.centerContent) {
    return (
      <View className="flex-1 justify-center">
        <MiniGuideProgrammeDetails
          description={
            showDescription ? (programme?.description ?? null) : null
          }
          metadata={metadata || MISSING_PROGRAMME_LABEL}
          title={programme?.title || MISSING_PROGRAMME_LABEL}
          titleNumberOfLines={isFocused ? 2 : 1}
          variant={variant}
        />
      </View>
    );
  }

  const longerTitle = dimensions.longerTitle;
  const useLongerTitle = isLongTitle && longerTitle !== null;
  const paddingVertical = useLongerTitle
    ? longerTitle.nextPaddingVertical
    : dimensions.cellPaddingVertical.next[isFocused ? "focused" : "collapsed"];

  return (
    <View className="flex-1" style={{ paddingVertical }}>
      <MiniGuideProgrammeDetails
        description={showDescription ? (programme?.description ?? null) : null}
        metadata={metadata || MISSING_PROGRAMME_LABEL}
        title={programme?.title || MISSING_PROGRAMME_LABEL}
        titleFontSize={useLongerTitle ? longerTitle.titleFontSize : undefined}
        titleLineHeight={
          useLongerTitle ? longerTitle.titleLineHeight : undefined
        }
        titleNumberOfLines={useLongerTitle ? 2 : 1}
        variant={variant}
      />
    </View>
  );
}
