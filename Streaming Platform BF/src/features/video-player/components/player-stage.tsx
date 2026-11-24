import type {
  PlayerError,
  PlayerInstance,
  PlayerStateChange,
  PlayerTimeUpdate,
} from "@bfbs/common-sdk";
import {
  type ComponentProps,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import {
  type GestureResponderEvent,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { Text } from "@/components";
import { PlayerLoadingOverlay } from "@/features/video-player/components/player-loading-overlay";

const DOUBLE_TAP_WINDOW_MS = 250;

type StagePlayerView = PlayerInstance<ReactElement>["PlayerView"];

type PlayerStageProps = {
  PlayerView: StagePlayerView | undefined;
  children?: ReactNode;
  hasSource: boolean;
  isLoading?: boolean;
  loadingDelayMs?: number;
  loadingHasBackdrop?: boolean;
  onPlayerError: (error: PlayerError) => void;
  onSkipBackward?: (() => void) | undefined;
  onSkipForward?: (() => void) | undefined;
  onSourceError: (error: unknown) => void;
  onStateChange: (change: PlayerStateChange) => void;
  onTimeUpdate: (update: PlayerTimeUpdate) => void;
  onToggleBody: () => void;
};

export function PlayerStage({
  PlayerView,
  children,
  hasSource,
  isLoading = false,
  loadingDelayMs = 0,
  loadingHasBackdrop = true,
  onPlayerError,
  onSkipBackward,
  onSkipForward,
  onSourceError,
  onStateChange,
  onTimeUpdate,
  onToggleBody,
}: PlayerStageProps) {
  const { width } = useWindowDimensions();
  const toggleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const canDoubleTapSkip = Boolean(onSkipBackward || onSkipForward);

  useEffect(() => () => clearTimeout(toggleTimerRef.current), []);

  const skipFromTap = (event: GestureResponderEvent) => {
    clearTimeout(toggleTimerRef.current);
    toggleTimerRef.current = undefined;

    if (event.nativeEvent.locationX < width / 2) {
      onSkipBackward?.();
    } else {
      onSkipForward?.();
    }
  };

  // Deferred so a second tap can cancel it.
  const scheduleToggle = () => {
    toggleTimerRef.current = setTimeout(() => {
      toggleTimerRef.current = undefined;
      onToggleBody();
    }, DOUBLE_TAP_WINDOW_MS);
  };

  const handleBodyPress = (event: GestureResponderEvent) => {
    if (!canDoubleTapSkip) {
      onToggleBody();
      return;
    }

    if (toggleTimerRef.current) {
      skipFromTap(event);
      return;
    }

    scheduleToggle();
  };

  let content: ReactElement;

  if (PlayerView && hasSource) {
    const PlayerViewWithTestId = PlayerView as ComponentType<
      ComponentProps<typeof PlayerView> & { testID?: string }
    >;

    content = (
      <PlayerViewWithTestId
        onError={onPlayerError}
        onStateChange={onStateChange}
        onTimeUpdate={onTimeUpdate}
        style={styles.player}
        testID="player-view"
        viewProps={{ onSourceError }}
      />
    );
  } else {
    content = isLoading ? (
      <View className="flex-1" />
    ) : (
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-white/50">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark-slate-blue">
      {content}

      <Pressable
        accessibilityRole="button"
        className="absolute inset-0"
        onPress={handleBodyPress}
        testID="player-body-toggle"
      />

      {children}

      {isLoading ? (
        <PlayerLoadingOverlay
          delayMs={loadingDelayMs}
          hasBackdrop={loadingHasBackdrop}
        />
      ) : null}
    </View>
  );
}

const styles = {
  player: { flex: 1 },
} as const;
