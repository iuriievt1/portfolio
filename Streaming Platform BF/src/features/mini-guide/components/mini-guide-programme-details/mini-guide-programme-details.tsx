import { View } from "react-native";
import { Text } from "@/components";
import { MINI_GUIDE_DIMENSIONS, MINI_GUIDE_TILE } from "../../constants";
import type { MiniGuideVariant } from "../../types";

type MiniGuideProgrammeDetailsProps = {
  description: string | null;
  fill?: boolean | undefined;
  metadata: string | null;
  title: string;
  titleFontSize?: number | undefined;
  titleLineHeight?: number | undefined;
  titleNumberOfLines: number;
  variant: MiniGuideVariant;
};

export function MiniGuideProgrammeDetails({
  description,
  fill = false,
  metadata,
  title,
  titleFontSize,
  titleLineHeight,
  titleNumberOfLines,
  variant,
}: MiniGuideProgrammeDetailsProps) {
  const dimensions = MINI_GUIDE_DIMENSIONS[variant];

  return (
    <View className={fill ? "flex-1" : ""}>
      <Text
        className="text-white"
        numberOfLines={titleNumberOfLines}
        style={{
          fontSize: titleFontSize ?? dimensions.titleFontSize,
          lineHeight: titleLineHeight ?? dimensions.titleLineHeight,
        }}
        weight="semibold"
      >
        {title}
      </Text>

      {metadata === null ? null : (
        <Text
          className="text-grey-40"
          numberOfLines={1}
          style={{
            fontSize: dimensions.metadataFontSize,
            lineHeight: dimensions.metadataLineHeight,
            marginTop: dimensions.titleMetadataGap,
          }}
          weight="semibold"
        >
          {metadata}
        </Text>
      )}

      {description === null ? null : (
        <Text
          className="text-white"
          numberOfLines={2}
          style={{
            fontSize: MINI_GUIDE_TILE.descriptionFontSize,
            lineHeight: MINI_GUIDE_TILE.descriptionLineHeight,
            marginTop: dimensions.metadataDescriptionGap,
          }}
          weight="normal"
        >
          {description}
        </Text>
      )}
    </View>
  );
}
