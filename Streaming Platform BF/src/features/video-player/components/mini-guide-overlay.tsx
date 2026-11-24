import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CloseSmallIcon from "@/assets/icons/close-small-icon.svg";
import { Button, Text } from "@/components";
import { theme } from "@/theme/theme";
import type { VideoSource } from "../types";

type MiniGuideOverlayProps = {
  onClose: () => void;
  source: VideoSource;
};

const MINI_GUIDE_HORIZONTAL_PADDING = 32;
const MINI_GUIDE_BOTTOM_PADDING = 32;

export function MiniGuideOverlay({ onClose, source }: MiniGuideOverlayProps) {
  const insets = useSafeAreaInsets();
  const horizontalPadding =
    MINI_GUIDE_HORIZONTAL_PADDING + Math.max(insets.left, insets.right);

  return (
    <View
      className="absolute inset-x-0 bottom-0 max-h-[45%] rounded-t bg-transparent-black-90 pt-5"
      style={{
        paddingBottom: MINI_GUIDE_BOTTOM_PADDING + insets.bottom,
        paddingLeft: horizontalPadding,
        paddingRight: horizontalPadding,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="mr-5 flex-1">
          <Text className="text-[20px] leading-6 text-white" weight="bold">
            Mini Guide
          </Text>
          <Text
            className="mt-2 text-[14px] leading-5 text-transparent-white-70"
            numberOfLines={2}
            weight="medium"
          >
            {source.channelTitle ?? "Live Channel"}
          </Text>
          <Text
            className="mt-3 text-[18px] leading-6 text-white"
            numberOfLines={2}
            weight="semibold"
          >
            {source.programme?.title ?? source.title}
          </Text>
        </View>
        <Button
          accessibilityLabel="Close mini guide"
          className="h-10 w-10"
          onPress={onClose}
          variant="icon"
        >
          <CloseSmallIcon color={theme.colors.white} height={24} width={24} />
        </Button>
      </View>
    </View>
  );
}
