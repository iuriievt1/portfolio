import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  type StyleProp,
  type TextStyle,
  type View,
  type ViewStyle,
} from "react-native";
import BackIcon from "@/assets/icons/back-icon.svg";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { theme } from "@/theme/theme";

type BackButtonProps = {
  className?: string;
  focusOnMount?: boolean;
  iconHeight: number;
  iconWidth: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID: string;
  textClassName?: string;
  textStyle?: StyleProp<TextStyle>;
};

/** Chevron plus "Back" label, shared by the details pages on phone and tablet. */
export function BackButton({
  className = "",
  focusOnMount = false,
  iconHeight,
  iconWidth,
  onPress,
  style,
  testID,
  textClassName = "text-[16px] text-white",
  textStyle,
}: BackButtonProps) {
  const buttonRef = useRef<View>(null);

  useEffect(() => {
    if (!focusOnMount) {
      return;
    }

    const handle = findNodeHandle(buttonRef.current);

    if (handle !== null) {
      AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [focusOnMount]);

  return (
    <Button
      accessibilityLabel="Back"
      buttonRef={buttonRef}
      className={`flex-row items-center gap-2 self-start ${className}`}
      onPress={onPress}
      style={style}
      testID={testID}
      variant="icon"
    >
      <BackIcon
        color={theme.colors.white}
        height={iconHeight}
        width={iconWidth}
      />
      <Text
        className={textClassName}
        style={[{ includeFontPadding: false }, textStyle]}
        weight="normal"
      >
        Back
      </Text>
    </Button>
  );
}
