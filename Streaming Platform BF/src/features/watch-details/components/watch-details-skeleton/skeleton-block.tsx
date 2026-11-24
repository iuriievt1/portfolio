import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

/** Muted block used to shape loading placeholders. */
export function SkeletonBlock({
  className = "",
  style,
  testID,
}: {
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      className={`bg-transparent-white-10 ${className}`}
      style={style}
      testID={testID}
    />
  );
}
