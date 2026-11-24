import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { MINI_GUIDE_DIMENSIONS } from "../../constants";
import { useMiniGuideAutoDismiss } from "../../hooks/use-mini-guide-auto-dismiss";
import type { MiniGuideChannel, MiniGuideVariant } from "../../types";
import { MiniGuidePanel } from "../mini-guide-panel/mini-guide-panel";

const SLIDE_DURATION_MS = 200;

type MiniGuideProps = {
  channels: MiniGuideChannel[];
  focusedChannelId: string | null;
  nowMs: number;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
  timeZone: string | undefined;
  variant: MiniGuideVariant;
};

export function MiniGuide({
  channels,
  focusedChannelId,
  nowMs,
  onClose,
  onSelectChannel,
  timeZone,
  variant,
}: MiniGuideProps) {
  const { panelHeight } = MINI_GUIDE_DIMENSIONS[variant];
  const translateY = useRef(new Animated.Value(panelHeight)).current;
  const registerInteraction = useMiniGuideAutoDismiss(onClose);

  useEffect(() => {
    Animated.timing(translateY, {
      duration: SLIDE_DURATION_MS,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  return (
    <View className="absolute inset-0" onTouchStart={registerInteraction}>
      <Pressable
        accessibilityLabel="Close mini guide"
        accessibilityRole="button"
        className="absolute inset-0"
        onPress={onClose}
        testID="mini-guide-backdrop"
      />
      <Animated.View
        className="absolute inset-x-0 bottom-0"
        style={{ transform: [{ translateY }] }}
      >
        <MiniGuidePanel
          channels={channels}
          focusedChannelId={focusedChannelId}
          nowMs={nowMs}
          onClose={onClose}
          onSelectChannel={onSelectChannel}
          timeZone={timeZone}
          variant={variant}
        />
      </Animated.View>
    </View>
  );
}
