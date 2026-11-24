import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import ProgrammeImageFallback from "@/assets/icons/programme-image-fallback.svg";
import { Text } from "@/components";
import { MISSING_PROGRAMME_LABEL } from "@/utils/programme";
import { MINI_GUIDE_DIMENSIONS, MINI_GUIDE_TILE } from "../../constants";
import type { MiniGuideProgramme, MiniGuideVariant } from "../../types";
import {
  formatProgrammeMetadata,
  getProgrammeProgress,
} from "../../utils/format-programme-time";
import { MiniGuideProgrammeDetails } from "../mini-guide-programme-details/mini-guide-programme-details";
import { MiniGuideProgressBar } from "../mini-guide-progress-bar/mini-guide-progress-bar";

type MiniGuideNowCellProps = {
  isFocused: boolean;
  isLongTitle: boolean;
  nowMs: number;
  onLongTitleChange?: ((isLong: boolean) => void) | undefined;
  programme: MiniGuideProgramme | null;
  timeZone: string | undefined;
  variant: MiniGuideVariant;
};

export function MiniGuideNowCell({
  isFocused,
  isLongTitle,
  nowMs,
  onLongTitleChange,
  programme,
  timeZone,
  variant,
}: MiniGuideNowCellProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | undefined>(
    undefined,
  );
  const dimensions = MINI_GUIDE_DIMENSIONS[variant];
  const showThumbnail = isFocused && dimensions.showNowThumbnail;
  const showDescription =
    isFocused && dimensions.showDescription && Boolean(programme?.description);
  const title = programme?.title || MISSING_PROGRAMME_LABEL;
  const metadata = programme
    ? formatProgrammeMetadata(programme, timeZone)
    : "";
  const secondaryLabel = metadata || MISSING_PROGRAMME_LABEL;
  const progress = programme ? getProgrammeProgress(programme, nowMs) : 0;
  const imageUrl = programme?.imageUrl;
  const showImageFallback = !imageUrl || imageUrl === failedImageUrl;

  const titleMeasurer = onLongTitleChange ? (
    <Text
      accessibilityElementsHidden
      className="absolute inset-x-0 opacity-0"
      importantForAccessibility="no-hide-descendants"
      onTextLayout={(event) => {
        onLongTitleChange(event.nativeEvent.lines.length > 1);
      }}
      style={{
        fontSize: dimensions.titleFontSize,
        lineHeight: dimensions.titleLineHeight,
      }}
      weight="semibold"
    >
      {title}
    </Text>
  ) : null;

  if (dimensions.centerContent) {
    const details = (
      <MiniGuideProgrammeDetails
        description={showDescription ? (programme?.description ?? null) : null}
        fill={showThumbnail}
        metadata={isFocused ? secondaryLabel : null}
        title={title}
        titleNumberOfLines={isFocused ? 2 : 1}
        variant={variant}
      />
    );

    return (
      <View className="flex-1 justify-center">
        {showThumbnail ? (
          <View className="flex-row" style={{ gap: MINI_GUIDE_TILE.gap }}>
            <View
              className="overflow-hidden"
              style={{
                borderRadius: MINI_GUIDE_TILE.thumbnailRadius,
                height: MINI_GUIDE_TILE.thumbnailHeight,
                width: MINI_GUIDE_TILE.thumbnailWidth,
              }}
            >
              {showImageFallback ? (
                <ProgrammeImageFallback
                  height={MINI_GUIDE_TILE.thumbnailHeight}
                  preserveAspectRatio="xMidYMid slice"
                  testID="mini-guide-programme-image-fallback"
                  width={MINI_GUIDE_TILE.thumbnailWidth}
                />
              ) : (
                <Image
                  contentFit="cover"
                  onError={() => setFailedImageUrl(imageUrl)}
                  source={{ uri: imageUrl }}
                  style={{ flex: 1 }}
                />
              )}
            </View>
            {details}
          </View>
        ) : (
          details
        )}
        <View style={{ marginTop: MINI_GUIDE_TILE.progressBarGap }}>
          <MiniGuideProgressBar isFocused={isFocused} progress={progress} />
        </View>
      </View>
    );
  }

  const longerTitle = dimensions.longerTitle;
  const useLongerTitle = isLongTitle && longerTitle !== null;
  const paddingVertical = useLongerTitle
    ? longerTitle.nowPaddingVertical
    : dimensions.cellPaddingVertical.now[isFocused ? "focused" : "collapsed"];

  return (
    <View className="flex-1 justify-between" style={{ paddingVertical }}>
      {titleMeasurer}
      <MiniGuideProgrammeDetails
        description={showDescription ? (programme?.description ?? null) : null}
        fill
        metadata={isFocused ? secondaryLabel : null}
        title={title}
        titleFontSize={useLongerTitle ? longerTitle.titleFontSize : undefined}
        titleLineHeight={
          useLongerTitle ? longerTitle.titleLineHeight : undefined
        }
        titleNumberOfLines={useLongerTitle ? 2 : 1}
        variant={variant}
      />
      <MiniGuideProgressBar isFocused={isFocused} progress={progress} />
    </View>
  );
}
