import { View } from "react-native";
import { MINI_GUIDE_TILE } from "../../constants";

type MiniGuideProgressBarProps = {
  isFocused: boolean;
  progress: number;
};

export function MiniGuideProgressBar({
  isFocused,
  progress,
}: MiniGuideProgressBarProps) {
  const widthPercent = Math.min(Math.max(progress, 0), 1) * 100;

  return (
    <View
      className="overflow-hidden rounded-full bg-transparent-white-10"
      style={{ height: MINI_GUIDE_TILE.progressBarHeight }}
    >
      <View
        className={`h-full rounded-full ${isFocused ? "bg-golden-yellow" : "bg-white"}`}
        style={{ width: `${widthPercent}%` }}
      />
    </View>
  );
}
