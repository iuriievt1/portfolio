import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import LoadingSpinnerArc from "@/assets/icons/player-loading-spinner.svg";
import { theme } from "@/theme/theme";

const SPINNER_DURATION_MS = 750;

type PlayerLoadingOverlayProps = {
  delayMs?: number;
  hasBackdrop?: boolean;
};

/** Shows the player loading indicator after an optional delay. */
export function PlayerLoadingOverlay({
  delayMs = 0,
  hasBackdrop = true,
}: PlayerLoadingOverlayProps) {
  const [isVisible, setIsVisible] = useState(delayMs === 0);
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (delayMs === 0) {
      setIsVisible(true);
      AccessibilityInfo.announceForAccessibility("Video loading");
      return;
    }

    setIsVisible(false);
    const timer = setTimeout(() => {
      setIsVisible(true);
      AccessibilityInfo.announceForAccessibility("Video loading");
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let isMounted = true;
    let animation: Animated.CompositeAnimation | undefined;

    const startAnimation = () => {
      if (!isMounted) {
        return;
      }

      animation = Animated.loop(
        Animated.timing(rotation, {
          duration: SPINNER_DURATION_MS,
          easing: Easing.linear,
          toValue: 1,
          useNativeDriver: true,
        }),
      );
      animation.start();
    };

    void AccessibilityInfo.isReduceMotionEnabled().then(
      (reduceMotionEnabled) => {
        if (!reduceMotionEnabled) {
          startAnimation();
        }
      },
      startAnimation,
    );

    return () => {
      isMounted = false;
      animation?.stop();
      rotation.setValue(0);
    };
  }, [isVisible, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      className="absolute inset-0 items-center justify-center"
      pointerEvents="none"
      style={hasBackdrop ? styles.backdrop : undefined}
      testID="player-loading-overlay"
    >
      {isVisible ? (
        <View
          accessibilityLabel="Video loading"
          accessibilityRole="progressbar"
          accessible
          style={styles.indicatorFrame}
          testID="player-loading-indicator"
        >
          <Animated.View
            importantForAccessibility="no-hide-descendants"
            style={[styles.spinner, { transform: [{ rotate }] }]}
          >
            <LoadingSpinnerArc
              height={13.7507}
              style={styles.spinnerArc}
              width={27.2024}
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: theme.colors["dark-slate-blue"],
  },
  indicatorFrame: {
    alignItems: "center",
    backgroundColor: theme.colors["transparent-white-20"],
    borderRadius: 37.5,
    height: 75,
    justifyContent: "center",
    width: 75,
  },
  spinner: {
    height: 30,
    width: 30,
  },
  spinnerArc: {
    left: 1.3988,
    position: "absolute",
    top: 1.2493,
  },
});
