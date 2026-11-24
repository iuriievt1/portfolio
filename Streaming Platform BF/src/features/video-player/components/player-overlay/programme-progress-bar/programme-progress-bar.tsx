import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components";
import { useScrubbableTrack } from "@/features/video-player/hooks/use-scrubbable-track";
import type { SeekRequest, VideoSource } from "@/features/video-player/types";
import { getProgrammeTimeAtProgress } from "@/features/video-player/utils/player-timing";
import { formatClockTime } from "@/utils/date-time";
import { clamp, toProgress } from "@/utils/number";

export function ProgrammeProgressBar({
  liveEdgeProgress,
  onInteraction,
  onSeek,
  playheadProgress,
  programme,
  timeZone,
}: {
  liveEdgeProgress: number;
  onInteraction: () => void;
  onSeek: (request: SeekRequest) => void;
  playheadProgress: number;
  programme: NonNullable<VideoSource["programme"]>;
  timeZone?: string;
}) {
  const [labelWidth, setLabelWidth] = useState(0);
  const { scrubProgress, trackProps, trackWidth } = useScrubbableTrack({
    maxProgress: liveEdgeProgress,
    onInteraction,
    onSeek,
  });

  const visibleProgress = toProgress(scrubProgress ?? playheadProgress);
  const labelLeft =
    trackWidth > 0 && labelWidth > 0
      ? clamp({
          max: Math.max(trackWidth - labelWidth, 0),
          min: 0,
          value: trackWidth * visibleProgress - labelWidth / 2,
        })
      : 0;
  const labelTimeMs = getProgrammeTimeAtProgress({
    programme,
    progress: visibleProgress,
  });
  const label = formatClockTime({
    timeMs: labelTimeMs,
    timeZone,
  });

  return (
    <View className="pt-[30px]">
      <Text
        className="absolute top-0 text-[18px] leading-[22px] text-white"
        onLayout={(event) => {
          setLabelWidth(event.nativeEvent.layout.width);
        }}
        style={{ left: labelLeft }}
        testID="programme-progress-label"
        weight="normal"
      >
        {label}
      </Text>
      <View
        className="h-[18px] justify-center"
        testID="programme-progress-track"
        {...trackProps}
      >
        <View
          className="h-[6px] rounded-full bg-transparent-white-20"
          pointerEvents="none"
        />
        <View
          className="absolute left-0 h-[6px] rounded-full bg-transparent-white-50"
          pointerEvents="none"
          style={{ width: `${liveEdgeProgress * 100}%` }}
          testID="live-edge-indicator"
        />
        <View
          className="absolute left-0 h-[6px] rounded-full bg-golden-yellow"
          pointerEvents="none"
          style={{ width: `${visibleProgress * 100}%` }}
        />
      </View>
    </View>
  );
}
