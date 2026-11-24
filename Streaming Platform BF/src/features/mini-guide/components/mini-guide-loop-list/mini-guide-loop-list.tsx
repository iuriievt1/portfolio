import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, FlatList, View } from "react-native";
import { MINI_GUIDE_DIMENSIONS } from "../../constants";
import type { MiniGuideChannel, MiniGuideVariant } from "../../types";
import { MiniGuideChannelRow } from "../mini-guide-channel-row/mini-guide-channel-row";

const LOOP_COPIES_PER_DIRECTION = 3;
const TOTAL_LOOP_COPIES = LOOP_COPIES_PER_DIRECTION * 2;
const SCRIM_HIDE_DURATION_MS = 200;

function rotateToFocused(channels: MiniGuideChannel[], focusedIndex: number) {
  if (focusedIndex <= 0) {
    return channels;
  }

  return [...channels.slice(focusedIndex), ...channels.slice(0, focusedIndex)];
}

type MiniGuideLoopListProps = {
  channels: MiniGuideChannel[];
  focusedChannelId: string | null;
  focusedIndex: number;
  nowMs: number;
  onSelectChannel: (channelId: string) => void;
  timeZone: string | undefined;
  variant: MiniGuideVariant;
};

/** Renders the looping channel list used by the live-player mini-guide. */
export function MiniGuideLoopList({
  channels,
  focusedChannelId,
  focusedIndex,
  nowMs,
  onSelectChannel,
  timeZone,
  variant,
}: MiniGuideLoopListProps) {
  const dimensions = MINI_GUIDE_DIMENSIONS[variant];
  const baseChannels = useMemo(
    () => rotateToFocused(channels, focusedIndex),
    [channels, focusedIndex],
  );

  const { collapsedRowHeight, focusedRowHeight, rowGap } = dimensions;
  const channelCount = baseChannels.length;
  const totalItemCount = channelCount * TOTAL_LOOP_COPIES;
  const data = useMemo(
    () => Array.from({ length: totalItemCount }, (_, index) => index),
    [totalItemCount],
  );
  const focusedPosition = baseChannels.findIndex(
    (channel) => channel.id === focusedChannelId,
  );
  const focusedRowExtra =
    focusedPosition >= 0 ? focusedRowHeight - collapsedRowHeight : 0;
  const copyHeight = channelCount * collapsedRowHeight + focusedRowExtra;
  const initialScrollIndex = LOOP_COPIES_PER_DIRECTION * channelCount;
  const visibleRowCount = Math.ceil(
    dimensions.rowsPanelHeight / (collapsedRowHeight + rowGap),
  );
  const initialRowsToRender = Math.min(channelCount, visibleRowCount + 2);

  const scrimOpacity = useRef(new Animated.Value(1)).current;
  const didHideScrimRef = useRef(false);
  const [isScrimSpacerVisible, setIsScrimSpacerVisible] = useState(true);

  const hideScrim = () => {
    if (didHideScrimRef.current) {
      return;
    }
    didHideScrimRef.current = true;
    Animated.timing(scrimOpacity, {
      duration: SCRIM_HIDE_DURATION_MS,
      toValue: 0,
      useNativeDriver: true,
    }).start(() => {
      setIsScrimSpacerVisible(false);
    });
  };
  const getItemLayout = useCallback(
    (_: ArrayLike<number> | null | undefined, index: number) => {
      const positionInCopy = index % channelCount;
      const focusedRowsBefore =
        focusedPosition >= 0 && positionInCopy > focusedPosition ? 1 : 0;
      const heightBeforeIndex =
        Math.floor(index / channelCount) * copyHeight +
        positionInCopy * collapsedRowHeight +
        focusedRowsBefore * focusedRowExtra;

      return {
        index,
        length:
          positionInCopy === focusedPosition
            ? focusedRowHeight
            : collapsedRowHeight,
        offset: rowGap * index + heightBeforeIndex,
      };
    },
    [
      channelCount,
      collapsedRowHeight,
      copyHeight,
      focusedPosition,
      focusedRowExtra,
      focusedRowHeight,
      rowGap,
    ],
  );
  const renderItem = useCallback(
    ({ item: index }: { item: number }) => {
      const channel = baseChannels[index % channelCount];

      if (!channel) {
        return null;
      }

      return (
        <MiniGuideChannelRow
          channel={channel}
          isFocused={channel.id === focusedChannelId}
          nowMs={nowMs}
          onSelect={onSelectChannel}
          timeZone={timeZone}
          variant={variant}
        />
      );
    },
    [
      baseChannels,
      channelCount,
      focusedChannelId,
      nowMs,
      onSelectChannel,
      timeZone,
      variant,
    ],
  );

  return (
    <View className="flex-1">
      <Animated.View
        style={{
          height: isScrimSpacerVisible ? rowGap : 0,
          opacity: scrimOpacity,
        }}
      />
      <FlatList
        contentContainerStyle={{ gap: rowGap }}
        data={data}
        getItemLayout={getItemLayout}
        initialNumToRender={initialRowsToRender}
        initialScrollIndex={initialScrollIndex}
        keyExtractor={(index) =>
          `${baseChannels[index % channelCount]?.id}-${index}`
        }
        maxToRenderPerBatch={initialRowsToRender}
        onScrollBeginDrag={hideScrim}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        updateCellsBatchingPeriod={50}
        windowSize={5}
      />
    </View>
  );
}
