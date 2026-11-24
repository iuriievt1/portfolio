import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

// Time away after which the app reopens on Home.
const GO_HOME_AFTER_MS = 30 * 60 * 1000;

/** Sends the user back to Home when they return after a long time away. */
export function useGoHomeAfterTimeAway() {
  const router = useRouter();
  const leftAtRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        leftAtRef.current = Date.now();
        return;
      }
      if (state !== "active" || leftAtRef.current === null) {
        return;
      }

      const timeAway = Date.now() - leftAtRef.current;
      leftAtRef.current = null;
      if (timeAway < GO_HOME_AFTER_MS) {
        return;
      }

      // Close the player or TV guide, then go back to Home.
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.dismissTo("/");
    });
    return () => subscription.remove();
  }, [router]);
}
