import { View } from "react-native";
import { Text } from "@/components";
import { formatRuntime } from "@/features/watch-details/utils/watch-details-metadata";

export function ContinueWatchingBar({
  progress,
  remainingSeconds,
  textClassName = "text-[14px]",
}: {
  progress: number;
  remainingSeconds: number;
  textClassName?: string;
}) {
  const remaining = formatRuntime(remainingSeconds);

  return (
    <View className="flex-row items-center gap-5">
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-transparent-white-50">
        <View
          className="h-full rounded-full bg-white"
          style={{ width: `${progress * 100}%` }}
        />
      </View>
      {remaining ? (
        <Text
          className={`${textClassName} text-oatmeal`}
          numberOfLines={1}
          weight="normal"
        >
          {`${remaining} remaining`}
        </Text>
      ) : null}
    </View>
  );
}
