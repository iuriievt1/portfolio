import { View } from "react-native";
import { Text } from "@/components";

const PHONE_BADGE_CLASSNAME =
  "h-[26px] border bg-transparent-black-80 px-[7px]";

/** Bordered badge that fits its label, e.g. "Leaving on 16 October at 15:00". */
export function LeavingSoonBadge({
  className = PHONE_BADGE_CLASSNAME,
  label,
  textClassName = "text-[14px]",
}: {
  className?: string;
  label: string;
  textClassName?: string;
}) {
  return (
    <View
      className={`items-center justify-center self-start rounded-[2px] border-slate-blue ${className}`}
    >
      <Text
        className={`${textClassName} text-white`}
        style={{ includeFontPadding: false }}
        weight="normal"
      >
        {label}
      </Text>
    </View>
  );
}
