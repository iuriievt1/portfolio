import type { PlaybackPlayerState } from "@bfbs/common-sdk";
import { type GestureResponderEvent, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CloseIcon from "@/assets/icons/close-icon.svg";
import SkipBackwardIcon from "@/assets/icons/skip-backward-icon.svg";
import SkipForwardIcon from "@/assets/icons/skip-forward-icon.svg";
import SubtitleIcon from "@/assets/icons/subtitle-icon.svg";
import { Button, Text } from "@/components";
import type { PlayerOverlayLayout } from "@/features/video-player/components/player-overlay";
import { PlayPauseButton } from "@/features/video-player/components/player-overlay/play-pause-button/play-pause-button";
import { PlayerScrim } from "@/features/video-player/components/player-overlay/player-scrim/player-scrim";
import { stopPressPropagation } from "@/features/video-player/components/player-overlay/utils/stop-press-propagation";
import type {
  SeekRequest,
  VodVideoSource,
} from "@/features/video-player/types";
import { getPlayerOverlayInsets } from "@/features/video-player/utils/overlay-insets";
import { formatVodEpisodeMetadata } from "@/features/video-player/utils/vod-metadata";
import { AgeRatingIcon } from "@/features/watch-details/components/age-rating-icon/age-rating-icon";
import { getContentWarning } from "@/features/watch-details/utils/more-details";
import { resolveAgeRating } from "@/features/watch-details/utils/watch-details-metadata";
import { theme } from "@/theme/theme";
import { VodProgressBar } from "./vod-progress-bar/vod-progress-bar";

type VodPlayerOverlayProps = {
  durationSeconds: number | null;
  layout: PlayerOverlayLayout;
  onClose: () => void;
  onInteraction: () => void;
  onSeek: (request: SeekRequest) => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onTogglePlayback: () => void;
  playerState: PlaybackPlayerState;
  positionSeconds: number;
  showAdvisory: boolean;
  source: VodVideoSource;
};

/** Renders VOD playback controls and catalogue-backed programme metadata. */
export function VodPlayerOverlay({
  durationSeconds,
  layout,
  onClose,
  onInteraction,
  onSeek,
  onSkipBackward,
  onSkipForward,
  onTogglePlayback,
  playerState,
  positionSeconds,
  showAdvisory,
  source,
}: VodPlayerOverlayProps) {
  const insets = useSafeAreaInsets();
  const {
    bottomOffset,
    horizontalInset,
    topOffset,
    videoHorizontalInset,
    videoVerticalInset,
  } = getPlayerOverlayInsets({ insets, layout });
  const ageRating = resolveAgeRating(source.parentalRating);
  const contentWarning = getContentWarning(source);
  const episodeMetadata = formatVodEpisodeMetadata(source);

  return (
    <View className="absolute inset-0" pointerEvents="box-none">
      <PlayerScrim
        horizontalInset={videoHorizontalInset}
        verticalInset={videoVerticalInset}
      />

      <View
        className="absolute flex-row items-center justify-between"
        style={{
          left: horizontalInset,
          right: horizontalInset,
          top: topOffset,
        }}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {showAdvisory && ageRating && (
            <AgeRatingIcon rating={ageRating} size={20} />
          )}

          {showAdvisory && contentWarning && (
            <>
              {ageRating && (
                <View
                  className="h-5 w-[3px] rounded-full bg-transparent-white-20"
                  testID="vod-advisory-divider"
                />
              )}

              <Text
                className="flex-1 text-[16px] leading-5 text-white"
                numberOfLines={1}
                testID="vod-content-warning"
                weight="normal"
              >
                {contentWarning}
              </Text>
            </>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Button
            accessibilityLabel="Subtitles"
            className="h-12 w-12"
            testID="vod-subtitles-action"
            variant="icon"
          >
            <SubtitleIcon color={theme.colors.white} height={20} width={20} />
          </Button>
          <Button
            accessibilityLabel="Close video player"
            className="-mr-3 h-12 w-12"
            onPress={(event: GestureResponderEvent) => {
              stopPressPropagation(event);
              onClose();
            }}
            variant="icon"
          >
            <CloseIcon color={theme.colors.white} height={20} width={20} />
          </Button>
        </View>
      </View>

      <View
        className="absolute inset-0 flex-row items-center justify-center gap-16"
        pointerEvents="box-none"
      >
        <Button
          accessibilityLabel="Skip backward 10 seconds"
          className="h-[75px] w-[75px] rounded-full bg-transparent-white-20"
          onPress={(event: GestureResponderEvent) => {
            stopPressPropagation(event);
            onSkipBackward();
          }}
          testID="vod-skip-backward-action"
          variant="icon"
        >
          <SkipBackwardIcon color={theme.colors.white} height={30} width={30} />
        </Button>
        <PlayPauseButton
          onPress={() => {
            onInteraction();
            onTogglePlayback();
          }}
          state={playerState}
          testID="vod-play-pause-action"
        />

        <Button
          accessibilityLabel="Skip forward 10 seconds"
          className="h-[75px] w-[75px] rounded-full bg-transparent-white-20"
          onPress={(event: GestureResponderEvent) => {
            stopPressPropagation(event);
            onSkipForward();
          }}
          testID="vod-skip-forward-action"
          variant="icon"
        >
          <SkipForwardIcon color={theme.colors.white} height={30} width={30} />
        </Button>
      </View>

      <View
        className="absolute"
        style={{
          bottom: bottomOffset,
          left: horizontalInset,
          right: horizontalInset,
        }}
      >
        <Text
          className="max-w-[80%] text-[20px] text-white"
          ellipsizeMode="tail"
          numberOfLines={1}
          testID="vod-player-title"
          weight="semibold"
        >
          {source.title}
        </Text>

        {episodeMetadata ? (
          <Text
            className="mt-2 max-w-[80%] text-[16px] leading-5 text-white"
            ellipsizeMode="tail"
            numberOfLines={1}
            testID="vod-player-episode-metadata"
            weight="normal"
          >
            {episodeMetadata}
          </Text>
        ) : null}

        <VodProgressBar
          durationSeconds={durationSeconds}
          onInteraction={onInteraction}
          onSeek={onSeek}
          onSkipBackward={onSkipBackward}
          onSkipForward={onSkipForward}
          positionSeconds={positionSeconds}
        />
      </View>
    </View>
  );
}
