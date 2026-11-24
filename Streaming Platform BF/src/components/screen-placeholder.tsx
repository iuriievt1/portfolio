import { View } from "react-native";

import { Text } from "@/components";

interface ScreenPlaceholderProps {
  title: string;
}

export function ScreenPlaceholder({ title }: ScreenPlaceholderProps) {
  const displayTitle = `To Be Replaced With ${title} Page`;

  return (
    <View className="flex-1 items-center justify-center bg-dark-slate-blue p-6">
      <View className="max-w-[360px] items-center">
        <Text className="text-center text-body-base text-white" weight="bold">
          {displayTitle}
        </Text>
      </View>
    </View>
  );
}
