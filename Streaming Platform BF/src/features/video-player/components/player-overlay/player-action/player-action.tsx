import type { ReactNode } from "react";
import type { GestureResponderEvent } from "react-native";
import { Button } from "@/components";
import { stopPressPropagation } from "../utils/stop-press-propagation";

export function PlayerAction({
  children,
  icon,
  onPress,
  testID,
}: {
  children: string;
  icon: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Button
      icon={icon}
      onPress={(event: GestureResponderEvent) => {
        stopPressPropagation(event);
        onPress?.();
      }}
      testID={testID}
      variant="action"
    >
      {children}
    </Button>
  );
}
