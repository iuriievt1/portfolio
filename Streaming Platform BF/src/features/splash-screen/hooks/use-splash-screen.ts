import * as NativeSplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

const SPLASH_FADE_DURATION_MS = 700;

type UseSplashScreenParams = {
  isAppReady: boolean;
  fontsLoaded: boolean;
  hasInitialisationError?: boolean;
};

type UseSplashScreenResult = {
  isSplashVisible: boolean;
  splashOpacity: Animated.Value;
};

export function useSplashScreen({
  isAppReady,
  fontsLoaded,
  hasInitialisationError = false,
}: UseSplashScreenParams): UseSplashScreenResult {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const hasHiddenNativeSplash = useRef(false);
  const isFadingSplash = useRef(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hasHiddenNativeSplash.current) {
      return;
    }

    hasHiddenNativeSplash.current = true;

    void NativeSplashScreen.hideAsync().catch(() => {
      // keep resilient — splash may already be hidden.
    });
  }, []);

  useEffect(() => {
    const isReadyToReveal = isAppReady || hasInitialisationError;

    if (!(fontsLoaded && isReadyToReveal) || isFadingSplash.current) {
      return;
    }

    let isMounted = true;
    isFadingSplash.current = true;

    Animated.timing(splashOpacity, {
      duration: SPLASH_FADE_DURATION_MS,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && isMounted) {
        setIsSplashVisible(false);
      }
    });

    return () => {
      isMounted = false;
      splashOpacity.stopAnimation();
    };
  }, [fontsLoaded, isAppReady, hasInitialisationError, splashOpacity]);

  return { isSplashVisible, splashOpacity };
}
