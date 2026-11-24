import { memo, useState } from "react";
import { Pressable, View } from "react-native";
import { theme } from "@/theme/theme";
import { MINI_GUIDE_DIMENSIONS, MINI_GUIDE_TILE } from "../../constants";
import type { MiniGuideChannel, MiniGuideVariant } from "../../types";
import { MiniGuideChannelLogo } from "../mini-guide-channel-logo/mini-guide-channel-logo";
import { MiniGuideNextCell } from "../mini-guide-next-cell/mini-guide-next-cell";
import { MiniGuideNowCell } from "../mini-guide-now-cell/mini-guide-now-cell";

const TILE_BASE_STYLE = {
  borderRadius: MINI_GUIDE_TILE.borderRadius,
  borderWidth: MINI_GUIDE_TILE.focusedBorderWidth,
  elevation: 6,
  paddingHorizontal: MINI_GUIDE_TILE.horizontalPadding,
  shadowColor: theme.colors["dark-slate-blue"],
  shadowOffset: { height: 2, width: 2 },
  shadowOpacity: 0.5,
  shadowRadius: 10,
} as const;

type MiniGuideChannelRowProps = {
  channel: MiniGuideChannel;
  isFocused: boolean;
  nowMs: number;
  onSelect: (channelId: string) => void;
  timeZone: string | undefined;
  variant: MiniGuideVariant;
};

function MiniGuideChannelRowComponent({
  channel,
  isFocused,
  nowMs,
  onSelect,
  timeZone,
  variant,
}: MiniGuideChannelRowProps) {
  const dimensions = MINI_GUIDE_DIMENSIONS[variant];
  const tileHeight = isFocused
    ? dimensions.focusedRowHeight
    : dimensions.collapsedRowHeight;
  const [hasLongTitle, setHasLongTitle] = useState(false);
  const longTitleCapable = variant === "mobile" && isFocused;
  const isLongTitle = longTitleCapable && hasLongTitle;

  return (
    <View className="flex-row" style={{ gap: dimensions.tileGap }}>
      <View
        className="bg-medium-slate-blue/70"
        style={{
          ...TILE_BASE_STYLE,
          borderColor: "transparent",
          height: tileHeight,
          width: dimensions.logoWidth,
        }}
      >
        <MiniGuideChannelLogo
          logoUrl={channel.logoUrl}
          name={channel.name}
          variant={variant}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        className="bg-medium-slate-blue/70"
        onPress={() => {
          onSelect(channel.id);
        }}
        style={{
          ...TILE_BASE_STYLE,
          borderColor: isFocused
            ? theme.colors["golden-yellow"]
            : "transparent",
          flex: dimensions.nowColumnFlex,
          height: tileHeight,
        }}
        testID={`mini-guide-row-${channel.id}`}
      >
        <MiniGuideNowCell
          isFocused={isFocused}
          isLongTitle={isLongTitle}
          nowMs={nowMs}
          onLongTitleChange={longTitleCapable ? setHasLongTitle : undefined}
          programme={channel.now}
          timeZone={timeZone}
          variant={variant}
        />
      </Pressable>

      <View
        className="bg-medium-slate-blue/70"
        style={{
          ...TILE_BASE_STYLE,
          borderColor: "transparent",
          flex: dimensions.nextColumnFlex,
          height: tileHeight,
        }}
      >
        <MiniGuideNextCell
          isFocused={isFocused}
          isLongTitle={isLongTitle}
          programme={channel.next}
          timeZone={timeZone}
          variant={variant}
        />
      </View>
    </View>
  );
}

/** Memoized mini-guide row so list ticks do not rebuild unchanged row chrome. */
export const MiniGuideChannelRow = memo(MiniGuideChannelRowComponent);
