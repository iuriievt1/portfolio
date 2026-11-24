import { Pressable } from "react-native";
import { Text } from "@/components";

export function WatchDetailsTabButton({
  className = "w-[90px]",
  isActive,
  label,
  onPress,
  textSizeClassName = "text-[14px] leading-[18px]",
}: {
  className?: string;
  isActive: boolean;
  label: string;
  onPress: () => void;
  textSizeClassName?: string;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      className={`h-8 items-center justify-center ${className}`}
      onPress={onPress}
    >
      <Text
        className={`${textSizeClassName} ${isActive ? "text-white" : "text-transparent-white-50"}`}
        style={{ includeFontPadding: false }}
        weight="semibold"
      >
        {label}
      </Text>
    </Pressable>
  );
}
