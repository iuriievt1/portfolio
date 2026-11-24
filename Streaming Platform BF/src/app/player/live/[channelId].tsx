import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, View } from "react-native";
import {
  MINI_GUIDE_ANALYTICS_SCREEN,
  PLAYER_ANALYTICS_SCREEN,
  screenChangeTracker,
} from "@/features/analytics/screens/screen-change-tracker";
import { setWatchedChannelId, useLiveChannels } from "@/features/live-channels";
import {
  getMiniGuideVariant,
  MiniGuide,
  useMiniGuideChannels,
} from "@/features/mini-guide";
import { useListingTimeZone } from "@/features/my-bfbs";
import { PlayerSurface } from "@/features/video-player/components/player-surface";
import { useLivePlayerSource } from "@/features/video-player/hooks/use-live-player-source/use-live-player-source";
import { useVideoPlayer } from "@/features/video-player/hooks/use-video-player";
import { isPlayingState } from "@/features/video-player/utils/player-timing";
import { useCurrentTime } from "@/hooks/use-current-time";
import { errorCodes } from "@/infra/error";

const CHANNEL_SWITCH_SAFETY_TIMEOUT_MS = 8000;
const MINI_GUIDE_CLOCK_TICK_MS = 15_000;

/** Renders live channel playback with mini-guide channel switching. */
export default function LivePlayerScreen() {
  const router = useRouter();
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const {
    channels,
    isLoading: areChannelsLoading,
    refreshLiveChannels,
  } = useLiveChannels();
  const { channels: miniGuideChannels } = useMiniGuideChannels();
  const timeZone = useListingTimeZone();
  const channel =
    channels.find((candidate) => candidate.id === channelId) ?? null;
  const {
    errorCode: sourceErrorCode,
    isLoading: isSourceLoading,
    retry: retrySource,
    source,
  } = useLivePlayerSource(channel);

  const handleProgrammeBoundary = useCallback(() => {
    void refreshLiveChannels();
  }, [refreshLiveChannels]);

  const [isClosing, setIsClosing] = useState(false);
  const playerSource = isSourceLoading ? undefined : (source ?? undefined);
  const player = useVideoPlayer({
    onProgrammeBoundary: handleProgrammeBoundary,
    source: playerSource,
    visible: !isClosing,
  });
  const { isMiniGuideOpen, overlayLayout, playerState, setIsMiniGuideOpen } =
    player;

  useEffect(() => {
    if (isClosing) {
      return;
    }

    const screen = isMiniGuideOpen
      ? MINI_GUIDE_ANALYTICS_SCREEN
      : PLAYER_ANALYTICS_SCREEN;

    screenChangeTracker.track(screen);
  }, [isClosing, isMiniGuideOpen]);
  const handleClose = () => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
  };

  const nowMs = useCurrentTime(isMiniGuideOpen, MINI_GUIDE_CLOCK_TICK_MS);

  const [isSwitchingChannel, setIsSwitchingChannel] = useState(false);
  const [previousChannelId, setPreviousChannelId] = useState(channelId);

  if (channelId !== previousChannelId) {
    setPreviousChannelId(channelId);

    if (previousChannelId) {
      setIsSwitchingChannel(true);
    }
  }

  const closeMiniGuide = useCallback(() => {
    setIsMiniGuideOpen(false);
  }, [setIsMiniGuideOpen]);

  const handleSelectChannel = useCallback(
    (selectedChannelId: string) => {
      // Keep the guide open when the current channel is tapped.
      if (selectedChannelId === channelId) {
        return;
      }

      setIsMiniGuideOpen(false);
      setWatchedChannelId(selectedChannelId);
      router.setParams({ channelId: selectedChannelId });
    },
    [channelId, router, setIsMiniGuideOpen],
  );

  useEffect(() => {
    if (
      isSwitchingChannel &&
      isPlayingState(playerState) &&
      playerSource?.channelId === channelId
    ) {
      setIsSwitchingChannel(false);
    }
  }, [channelId, isSwitchingChannel, playerSource?.channelId, playerState]);

  useEffect(() => {
    if (!isSwitchingChannel) {
      return;
    }

    const safetyTimer = setTimeout(() => {
      setIsSwitchingChannel(false);
    }, CHANNEL_SWITCH_SAFETY_TIMEOUT_MS);

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [isSwitchingChannel]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isClosing) {
          return true;
        }

        if (isMiniGuideOpen) {
          setIsMiniGuideOpen(false);
          return true;
        }

        return false;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isClosing, isMiniGuideOpen, setIsMiniGuideOpen]);

  const hasClosedRef = useRef(false);

  useEffect(() => {
    if (!isClosing || hasClosedRef.current) {
      return;
    }

    hasClosedRef.current = true;
    router.back();
  }, [isClosing, router]);

  const isChannelMissing = !(areChannelsLoading || channel);
  const errorCode =
    sourceErrorCode ??
    (isChannelMissing ? errorCodes.contentUnavailable : null);

  if (isClosing) {
    return <View className="flex-1 bg-black" testID="live-player-closing" />;
  }

  const miniGuideVariant = getMiniGuideVariant({
    isLandscape: overlayLayout.isLandscape,
    isTablet: overlayLayout.isTablet,
  });

  return (
    <PlayerSurface
      errorCode={errorCode}
      hideControlsForMiniGuide
      isLoading={isSwitchingChannel}
      miniGuide={
        <MiniGuide
          channels={miniGuideChannels}
          focusedChannelId={channelId ?? null}
          nowMs={nowMs}
          onClose={closeMiniGuide}
          onSelectChannel={handleSelectChannel}
          timeZone={timeZone}
          variant={miniGuideVariant}
        />
      }
      onClose={handleClose}
      onRetrySource={retrySource}
      player={player}
      source={playerSource}
    />
  );
}
