import { useEffect, useRef, useState } from "react";
import { Animated, useWindowDimensions } from "react-native";
import type { PlayerOverlayLayout } from "@/features/video-player/components/player-overlay";
import { useImmersiveMode } from "@/features/video-player/hooks/use-player-chrome/use-immersive-mode";
import { usePlayerControlsVisibility } from "@/features/video-player/hooks/use-player-chrome/use-player-controls-visibility";
import { reportError } from "@/infra/error";
import { isLandscapeLayout, isTabletDevice } from "@/utils/device-layout";
import { getExpoScreenOrientationModule } from "@/utils/expo-native-modules";

const CONTROLS_FADE_IN_MS = 150;
const CONTROLS_FADE_OUT_MS = 200;

export function usePlayerChrome(visible: boolean) {
  const { height, width } = useWindowDimensions();
  const isTablet = isTabletDevice({ height, width });
  const isLandscape = isLandscapeLayout({ height, width });
  const videoVerticalInset = Math.max((height - (width * 9) / 16) / 2, 0);
  const videoHorizontalInset = Math.max((width - (height * 16) / 9) / 2, 0);
  const overlayLayout: PlayerOverlayLayout = {
    isLandscape,
    isTablet,
    videoHorizontalInset,
    videoVerticalInset,
  };

  useImmersiveMode(visible && !isTablet);

  const [shouldRenderControls, setShouldRenderControls] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const { areControlsVisible, markInteraction, toggleControlsFromBodyPress } =
    usePlayerControlsVisibility(visible);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const ScreenOrientation = getExpoScreenOrientationModule();

    if (isTablet) {
      void ScreenOrientation.unlockAsync().catch((err) => {
        reportError(err);
      });
      return;
    }

    const lockPromise = ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );

    return () => {
      void lockPromise
        .catch((err) => {
          reportError(err);
        })
        .then(() => ScreenOrientation.unlockAsync())
        .then(() =>
          ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP,
          ),
        )
        .catch((err) => {
          reportError(err);
        });
    };
  }, [isTablet, visible]);

  useEffect(() => {
    if (!visible) {
      setShouldRenderControls(true);
      controlsOpacity.setValue(1);
    }
  }, [controlsOpacity, visible]);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    if (areControlsVisible) {
      setShouldRenderControls(true);
      Animated.timing(controlsOpacity, {
        duration: CONTROLS_FADE_IN_MS,
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return () => {
        controlsOpacity.stopAnimation();
      };
    }

    Animated.timing(controlsOpacity, {
      duration: CONTROLS_FADE_OUT_MS,
      toValue: 0,
      useNativeDriver: true,
    }).start();

    fadeTimer = setTimeout(() => {
      setShouldRenderControls(false);
    }, CONTROLS_FADE_OUT_MS);

    return () => {
      if (fadeTimer) {
        clearTimeout(fadeTimer);
      }

      controlsOpacity.stopAnimation();
    };
  }, [areControlsVisible, controlsOpacity]);

  return {
    controlsOpacity,
    markInteraction,
    overlayLayout,
    shouldRenderControls,
    toggleControlsFromBodyPress,
  };
}
