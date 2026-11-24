import { Portal } from "@gorhom/portal";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, StyleSheet } from "react-native";

const FADE_DURATION_MS = 200;

type PlayerPortalProps = {
  children: ReactNode;
  onClose: () => void;
  visible: boolean;
};

export function PlayerPortal({
  children,
  onClose,
  visible,
}: PlayerPortalProps) {
  const [isMounted, setIsMounted] = useState(visible);
  const containerOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.timing(containerOpacity, {
        duration: FADE_DURATION_MS,
        toValue: 1,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(containerOpacity, {
      duration: FADE_DURATION_MS,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [containerOpacity, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [onClose, visible]);

  if (!isMounted) {
    return null;
  }

  return (
    <Portal>
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: containerOpacity }]}
      >
        {children}
      </Animated.View>
    </Portal>
  );
}
