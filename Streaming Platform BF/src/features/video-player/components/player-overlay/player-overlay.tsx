import type { PlaybackPlayerState } from "@bfbs/common-sdk";
import { type GestureResponderEvent, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChevronUpIcon from "@/assets/icons/chevron-up-icon.svg";
import CloseIcon from "@/assets/icons/close-icon.svg";
import GoToLiveIcon from "@/assets/icons/go-to-live-icon.svg";
import LiveStatusIcon from "@/assets/icons/live-status-icon.svg";
import RestartIcon from "@/assets/icons/restart-icon.svg";
import { Button, Text } from "@/components";
import { useListingTimeZone } from "@/features/my-bfbs";
import type { SeekRequest, VideoSource } from "@/features/video-player/types";
import { getPlayerOverlayInsets } from "@/features/video-player/utils/overlay-insets";
import type { LivePlayerTiming } from "@/features/video-player/utils/player-timing";
import { theme } from "@/theme/theme";
import { formatProgrammeRange } from "@/utils/programme";
import { PlayPauseButton } from "./play-pause-button/play-pause-button";
import { PlayerAction } from "./player-action/player-action";
import { PlayerScrim } from "./player-scrim/player-scrim";
import { ProgrammeProgressBar } from "./programme-progress-bar/programme-progress-bar";
import { stopPressPropagation } from "./utils/stop-press-propagation";

type PlayerOverlayProps = {
  areControlsVisible: boolean;
  hidesPlaybackControls?: boolean | undefined;
  isBehindLive: boolean;
  isMiniGuideOpen: boolean;
  layout: PlayerOverlayLayout;
  onClose: () => void;
  onInteraction: () => void;
  onSeek: (request: SeekRequest) => void;
  onTogglePlayback: () => void;
  onToggleMiniGuide: () => void;
  playerState: PlaybackPlayerState;
  source: VideoSource;
  timing: LivePlayerTiming | null;
};

export type PlayerOverlayLayout = {
  isLandscape: boolean;
  isTablet: boolean;
  videoHorizontalInset: number;
  videoVerticalInset: number;
};

const STATUS_BEHIND_LIVE_COLOR = theme.colors["grey-20"];
const STATUS_LIVE_COLOR = theme.colors.red;

/** Renders the live-player controls and now-playing metadata overlay. */
export function PlayerOverlay({
  areControlsVisible,
  hidesPlaybackControls = false,
  isBehindLive,
  isMiniGuideOpen,
  layout,
  onClose,
  onInteraction,
  onSeek,
  onTogglePlayback,
  onToggleMiniGuide,
  playerState,
  source,
  timing,
}: PlayerOverlayProps) {
  const programme = source.programme;
  const timeZone = useListingTimeZone();
  const programmeRange = programme
    ? formatProgrammeRange({
        endsAt: programme.endsAt,
        startsAt: programme.startsAt,
        timeZone,
      })
    : "";
  const insets = useSafeAreaInsets();
  const statusColor = isBehindLive
    ? STATUS_BEHIND_LIVE_COLOR
    : STATUS_LIVE_COLOR;
  const {
    bottomOffset,
    horizontalInset,
    topOffset,
    videoHorizontalInset,
    videoVerticalInset,
  } = getPlayerOverlayInsets({ insets, layout });

  if (!areControlsVisible) {
    return null;
  }

  return (
    <View className="absolute inset-0" pointerEvents="box-none">
      {hidesPlaybackControls ? null : (
        <PlayerScrim
          horizontalInset={videoHorizontalInset}
          verticalInset={videoVerticalInset}
        />
      )}

      <View
        className="absolute flex-row items-center justify-between"
        style={{
          left: horizontalInset,
          right: horizontalInset,
          top: topOffset,
        }}
      >
        <View className="max-w-[70%]">
          <View className="flex-row items-center">
            <LiveStatusIcon color={statusColor} height={10} width={10} />
            <Text
              className="ml-1 text-[16px] leading-5"
              style={{ color: statusColor, includeFontPadding: false }}
              weight="normal"
            >
              LIVE
            </Text>
            {programmeRange ? (
              <Text
                className="ml-2 text-[16px] leading-5 text-white"
                style={{ includeFontPadding: false }}
                weight="normal"
              >
                {programmeRange}
              </Text>
            ) : null}
          </View>
          <Text
            className="mt-3 text-[20px] leading-7 text-white"
            numberOfLines={2}
            weight="semibold"
          >
            {programme?.title ?? source.title}
          </Text>
        </View>

        <Button
          accessibilityLabel="Close live player"
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

      {hidesPlaybackControls ? null : (
        <View
          className="absolute inset-0 items-center justify-center"
          pointerEvents="box-none"
        >
          <PlayPauseButton
            mediaLabel="live playback"
            onPress={() => {
              onInteraction();
              onTogglePlayback();
            }}
            state={playerState}
            testID="play-pause-action"
          />
        </View>
      )}

      <View
        className="absolute"
        pointerEvents={hidesPlaybackControls ? "none" : "auto"}
        style={{
          bottom: bottomOffset,
          display: hidesPlaybackControls ? "none" : "flex",
          left: horizontalInset,
          right: horizontalInset,
        }}
      >
        {programme && timing ? (
          <ProgrammeProgressBar
            liveEdgeProgress={timing.liveEdgeProgress}
            onInteraction={onInteraction}
            onSeek={onSeek}
            playheadProgress={timing.playheadProgress}
            programme={programme}
            timeZone={timeZone}
          />
        ) : null}

        <View className="mt-6 flex-row items-center justify-center gap-4">
          <PlayerAction
            icon={
              <RestartIcon color={theme.colors.white} height={20} width={20} />
            }
            onPress={() => {
              onInteraction();
              onSeek({ progress: 0 });
            }}
            testID="restart-action"
          >
            Restart
          </PlayerAction>
          <PlayerAction
            icon={
              <ChevronUpIcon
                color={theme.colors.white}
                height={20}
                style={{
                  transform: [{ rotate: isMiniGuideOpen ? "180deg" : "0deg" }],
                }}
                width={20}
              />
            }
            onPress={() => {
              onInteraction();
              onToggleMiniGuide();
            }}
            testID="mini-guide-action"
          >
            Mini Guide
          </PlayerAction>
          {isBehindLive && (
            <PlayerAction
              icon={
                <GoToLiveIcon
                  color={theme.colors.white}
                  height={20}
                  width={20}
                />
              }
              onPress={() => {
                onInteraction();
                onSeek({ progress: 1 });
              }}
              testID="go-to-live-action"
            >
              Go To Live
            </PlayerAction>
          )}
        </View>
      </View>
    </View>
  );
}
