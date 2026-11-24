import * as NavigationBar from "expo-navigation-bar";
import { setStatusBarHidden } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { reportError } from "@/infra/error";

export function useImmersiveMode(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    setStatusBarHidden(true, "fade");

    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("hidden").catch(reportError);
    }

    return () => {
      setStatusBarHidden(false, "fade");

      if (Platform.OS === "android") {
        NavigationBar.setVisibilityAsync("visible").catch(reportError);
      }
    };
  }, [enabled]);
}
