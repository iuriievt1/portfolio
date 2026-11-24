import type { PlaybackPlayerState } from "@bfbs/common-sdk";
import type { GestureResponderEvent } from "react-native";
import PauseIcon from "@/assets/icons/pause-icon.svg";
import PlayIcon from "@/assets/icons/play-icon.svg";
import { Button } from "@/components";
import { isPlayingState } from "@/features/video-player/utils/player-timing";
import { theme } from "@/theme/theme";
import { stopPressPropagation } from "../utils/stop-press-propagation";

const ICON_COLOR = theme.colors.white;

export function PlayPauseButton({
  mediaLabel = "playback",
  onPress,
  state,
  testID,
}: {
  mediaLabel?: string;
  onPress?: () => void;
  state: PlaybackPlayerState;
  testID?: string;
}) {
  const isPlaying = isPlayingState(state);

  return (
    <Button
      accessibilityLabel={
        isPlaying ? `Pause ${mediaLabel}` : `Resume ${mediaLabel}`
      }
      className="h-[75px] w-[75px] rounded-full bg-transparent-white-20"
      onPress={(event: GestureResponderEvent) => {
        stopPressPropagation(event);
        onPress?.();
      }}
      testID={testID}
      variant="icon"
    >
      {isPlaying ? (
        <PauseIcon color={ICON_COLOR} height={30} width={30} />
      ) : (
        <PlayIcon color={ICON_COLOR} height={30} width={30} />
      )}
    </Button>
  );
}
