import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChevronUpIcon from "@/assets/icons/chevron-up-icon.svg";
import { Text } from "@/components";
import { theme } from "@/theme/theme";
import {
  MINI_GUIDE_DIMENSIONS,
  MINI_GUIDE_PANEL,
  MINI_GUIDE_TILE,
} from "../../constants";
import type { MiniGuideChannel, MiniGuideVariant } from "../../types";
import { MiniGuideChannelRow } from "../mini-guide-channel-row/mini-guide-channel-row";
import { MiniGuideLoopList } from "../mini-guide-loop-list/mini-guide-loop-list";

const LABEL_SHADOW_STYLE = {
  textShadowColor: `${theme.colors["dark-slate-blue"]}80`,
  textShadowOffset: { height: 2, width: 2 },
  textShadowRadius: 10,
} as const;

const LABEL_TEXT_OFFSET = -(
  MINI_GUIDE_TILE.horizontalPadding + MINI_GUIDE_TILE.focusedBorderWidth
);

const LABEL_TEXT_STYLE = {
  fontSize: MINI_GUIDE_PANEL.labelFontSize,
  lineHeight: MINI_GUIDE_PANEL.labelLineHeight,
} as const;

const LABEL_COLUMN_BOX = {
  borderColor: "transparent",
  borderWidth: MINI_GUIDE_TILE.focusedBorderWidth,
  paddingHorizontal: MINI_GUIDE_TILE.horizontalPadding,
} as const;

type MiniGuidePanelProps = {
  channels: MiniGuideChannel[];
  focusedChannelId: string | null;
  nowMs: number;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
  timeZone: string | undefined;
  variant: MiniGuideVariant;
};

export function MiniGuidePanel({
  channels,
  focusedChannelId,
  nowMs,
  onClose,
  onSelectChannel,
  timeZone,
  variant,
}: MiniGuidePanelProps) {
  const dimensions = MINI_GUIDE_DIMENSIONS[variant];
  const focusedIndex = channels.findIndex(
    (channel) => channel.id === focusedChannelId,
  );
  const isLoop = channels.length >= 2;
  const insets = useSafeAreaInsets();
  const paddingLeft = Math.max(dimensions.panelHorizontalPadding, insets.left);
  const paddingRight = Math.max(dimensions.panelPaddingRight, insets.right);

  return (
    <View style={{ gap: MINI_GUIDE_PANEL.rowGap }}>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2"
        onPress={onClose}
      >
        <ChevronUpIcon
          color={theme.colors.white}
          height={20}
          style={{ transform: [{ rotate: "180deg" }] }}
          width={20}
        />
        <Text
          className="text-white"
          style={[LABEL_SHADOW_STYLE, LABEL_TEXT_STYLE]}
          weight="semibold"
        >
          Hide Mini Guide
        </Text>
      </Pressable>

      <View
        className="flex-row"
        style={{
          gap: dimensions.tileGap,
          paddingLeft,
          paddingRight,
        }}
      >
        <View style={{ width: dimensions.logoWidth }} />
        <View style={[LABEL_COLUMN_BOX, { flex: dimensions.nowColumnFlex }]}>
          <Text
            className="text-white"
            style={[
              LABEL_SHADOW_STYLE,
              LABEL_TEXT_STYLE,
              { marginLeft: LABEL_TEXT_OFFSET },
            ]}
            weight="semibold"
          >
            Now
          </Text>
        </View>
        <View style={[LABEL_COLUMN_BOX, { flex: dimensions.nextColumnFlex }]}>
          <Text
            className="text-white"
            style={[
              LABEL_SHADOW_STYLE,
              LABEL_TEXT_STYLE,
              { marginLeft: LABEL_TEXT_OFFSET },
            ]}
            weight="semibold"
          >
            Next
          </Text>
        </View>
      </View>

      <View
        className="overflow-hidden bg-transparent-black-40"
        style={{
          borderTopLeftRadius: MINI_GUIDE_TILE.rowsPanelRadius,
          borderTopRightRadius: MINI_GUIDE_TILE.rowsPanelRadius,
          height: dimensions.rowsPanelHeight,
          paddingLeft,
          paddingRight,
        }}
      >
        {isLoop ? (
          <MiniGuideLoopList
            channels={channels}
            focusedChannelId={focusedChannelId}
            focusedIndex={focusedIndex}
            nowMs={nowMs}
            onSelectChannel={onSelectChannel}
            timeZone={timeZone}
            variant={variant}
          />
        ) : (
          <FlatList
            contentContainerStyle={{
              gap: dimensions.rowGap,
              paddingTop: dimensions.rowGap,
            }}
            data={channels}
            keyExtractor={(channel) => channel.id}
            renderItem={({ item }) => (
              <MiniGuideChannelRow
                channel={item}
                isFocused={item.id === focusedChannelId}
                nowMs={nowMs}
                onSelect={onSelectChannel}
                timeZone={timeZone}
                variant={variant}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
