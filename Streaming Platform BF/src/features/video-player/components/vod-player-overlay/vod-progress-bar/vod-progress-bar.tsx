import { View } from "react-native";
import { Text } from "@/components";
import { useScrubbableTrack } from "@/features/video-player/hooks/use-scrubbable-track";
import type { SeekRequest } from "@/features/video-player/types";
import {
  formatVodTime,
  getVodProgress,
} from "@/features/video-player/utils/vod-timing";

// Equal-width digits, so a fatter 8 cannot shift the timecodes in place.
const TIMECODE_STYLE = { fontVariant: ["tabular-nums" as const] };
const ACCESSIBILITY_ACTIONS = [
  { name: "increment" },
  { name: "decrement" },
] as const;
const PLAYHEAD_SIZE = 18;
const TRACK_HIT_SLOP = { bottom: 16, left: 8, right: 8, top: 16 };

/** Renders the VOD timeline, timecodes, and draggable playhead. */
export function VodProgressBar({
  durationSeconds,
  onInteraction,
  onSeek,
  onSkipBackward,
  onSkipForward,
  positionSeconds,
}: {
  durationSeconds: number | null;
  onInteraction: () => void;
  onSeek: (request: SeekRequest) => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  positionSeconds: number;
}) {
  const hasDuration = durationSeconds !== null;
  const { scrubProgress, trackProps, trackWidth } = useScrubbableTrack({
    enabled: hasDuration,
    onInteraction,
    onSeek,
    seekWhileScrubbing: true,
  });

  const playheadProgress = getVodProgress({ durationSeconds, positionSeconds });
  const visibleProgress = scrubProgress ?? playheadProgress;
  const playheadTranslateX = Math.min(
    Math.max(visibleProgress * trackWidth - PLAYHEAD_SIZE / 2, 0),
    Math.max(trackWidth - PLAYHEAD_SIZE, 0),
  );
  const elapsedSeconds =
    scrubProgress !== null && hasDuration
      ? scrubProgress * durationSeconds
      : positionSeconds;
  const elapsedLabel = formatVodTime(elapsedSeconds);
  const accessibilityPositionSeconds = hasDuration
    ? Math.min(Math.max(Math.floor(elapsedSeconds), 0), durationSeconds)
    : 0;

  function handleAccessibilityAction(actionName: string) {
    if (!hasDuration) {
      return;
    }

    if (actionName === "increment") {
      onSkipForward();
    } else if (actionName === "decrement") {
      onSkipBackward();
    }
  }

  return (
    <View className="pt-[20px]">
      <View className="flex-row items-center justify-between gap-2">
        <Text
          className="w-[80px] text-[18px] leading-[22px] text-white"
          style={TIMECODE_STYLE}
          testID="vod-elapsed-label"
          weight="normal"
        >
          {elapsedLabel}
        </Text>

        <View
          accessibilityActions={hasDuration ? ACCESSIBILITY_ACTIONS : []}
          accessibilityHint={
            hasDuration ? "Swipe up or down to seek by 10 seconds" : undefined
          }
          accessibilityLabel="Playback position"
          accessibilityRole="adjustable"
          accessibilityState={{ disabled: !hasDuration }}
          accessibilityValue={
            hasDuration
              ? {
                  max: Math.floor(durationSeconds),
                  min: 0,
                  now: accessibilityPositionSeconds,
                  text: `${formatVodTime(accessibilityPositionSeconds)} of ${formatVodTime(durationSeconds)}`,
                }
              : { text: "Duration unavailable" }
          }
          accessible
          className="h-[18px] flex-1 justify-center"
          hitSlop={TRACK_HIT_SLOP}
          onAccessibilityAction={({ nativeEvent: { actionName } }) => {
            handleAccessibilityAction(actionName);
          }}
          testID="vod-progress-track"
          {...trackProps}
        >
          <View
            className="h-[6px] rounded-full bg-transparent-white-20"
            pointerEvents="none"
          />
          <View
            className="absolute left-0 h-[6px] rounded-full bg-golden-yellow"
            pointerEvents="none"
            style={{ width: `${visibleProgress * 100}%` }}
          />
          <View
            className="absolute left-0 top-0 rounded-full bg-golden-yellow"
            pointerEvents="none"
            style={{
              height: PLAYHEAD_SIZE,
              transform: [{ translateX: playheadTranslateX }],
              width: PLAYHEAD_SIZE,
            }}
            testID="vod-progress-playhead"
          />
        </View>

        <Text
          className="w-[80px] text-right text-[18px] leading-[22px] text-white"
          style={TIMECODE_STYLE}
          testID="vod-remaining-label"
          weight="normal"
        >
          {hasDuration ? formatVodTime(durationSeconds) : ""}
        </Text>
      </View>
    </View>
  );
}
