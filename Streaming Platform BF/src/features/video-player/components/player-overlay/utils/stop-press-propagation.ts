import type { GestureResponderEvent } from "react-native";

export function stopPressPropagation(event?: GestureResponderEvent) {
  event?.stopPropagation?.();
}
