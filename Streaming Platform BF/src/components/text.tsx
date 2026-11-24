import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { theme } from "@/theme/theme";

type FontWeight = "light" | "normal" | "medium" | "semibold" | "bold";

interface TextProps extends RNTextProps {
  weight?: FontWeight;
  className?: string;
}

const fontMap: Record<FontWeight, string> = {
  light: theme.fontFamily["euclid-light"],
  normal: theme.fontFamily["euclid-regular"],
  medium: theme.fontFamily["euclid-medium"],
  semibold: theme.fontFamily["euclid-semibold"],
  bold: theme.fontFamily["euclid-bold"],
};

function extractWeightFromClassName(className?: string): FontWeight | null {
  if (!className) {
    return null;
  }
  if (
    className.includes("font-bold") ||
    className.includes("font-euclid-bold")
  ) {
    return "bold";
  }
  if (
    className.includes("font-semibold") ||
    className.includes("font-euclid-semibold")
  ) {
    return "semibold";
  }
  if (
    className.includes("font-medium") ||
    className.includes("font-euclid-medium")
  ) {
    return "medium";
  }
  if (
    className.includes("font-normal") ||
    className.includes("font-euclid-regular")
  ) {
    return "normal";
  }
  if (
    className.includes("font-light") ||
    className.includes("font-euclid-light")
  ) {
    return "light";
  }
  return null;
}

export function Text({
  weight = "normal",
  className,
  style,
  children,
  ...props
}: TextProps) {
  const classWeight = extractWeightFromClassName(className);
  const resolvedWeight = classWeight ?? weight;

  return (
    <RNText
      {...props}
      {...(className ? { className } : {})}
      style={[{ fontFamily: fontMap[resolvedWeight] }, style]}
    >
      {children}
    </RNText>
  );
}
