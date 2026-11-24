import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import PlaySolidIcon from "@/assets/icons/play-solid-icon.svg";
import PlusIcon from "@/assets/icons/plus-icon.svg";
import { Text } from "@/components";
import { theme } from "@/theme/theme";

const ICON_SIZE = 16;

type ActionButtonProps = {
  backgroundClassName: string;
  icon: ReactNode;
  label: string;
  labelClassName: string;
  onPress?: (() => void) | undefined;
  testID: string;
  textSizeClassName: string;
  width: number | undefined;
};

function ActionButton({
  backgroundClassName,
  icon,
  label,
  labelClassName,
  onPress,
  testID,
  textSizeClassName,
  width,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: onPress === undefined }}
      className={`h-[45px] flex-row items-center justify-center gap-2 rounded-full ${backgroundClassName}`}
      onPress={onPress}
      style={width === undefined ? undefined : { width }}
      testID={testID}
    >
      {icon}
      <Text
        className={`${textSizeClassName} ${labelClassName}`}
        style={{ includeFontPadding: false }}
        weight="bold"
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The label size the tablet designs give every action button. */
export const TABLET_ACTION_TEXT_CLASS = "text-[16px]";

type WatchDetailsActionsProps = {
  buttonWidth?: number | undefined;
  direction?: "column" | "row";
  onSecondary?: (() => void) | undefined;
  onWatch: () => void;
  secondaryIcon?: ReactNode;
  secondaryLabel?: string;
  secondaryTestID?: string;
  showSecondary?: boolean;
  showWatch?: boolean;
  textSizeClassName?: string | undefined;
  watchLabel?: string;
  watchTestID?: string;
};

/** Watch action paired with a secondary one, stacked on phones or side by side; either can be hidden. */
export function WatchDetailsActions({
  buttonWidth,
  direction = "column",
  onSecondary,
  onWatch,
  secondaryIcon = (
    <PlusIcon color={theme.colors.white} height={ICON_SIZE} width={ICON_SIZE} />
  ),
  secondaryLabel = "My List",
  secondaryTestID = "watch-details-my-list",
  showSecondary = true,
  showWatch = true,
  textSizeClassName = "text-[14px] leading-[24px]",
  watchLabel = "Watch",
  watchTestID = "watch-details-watch",
}: WatchDetailsActionsProps) {
  return (
    <View
      className={direction === "row" ? "flex-row" : ""}
      style={{ gap: direction === "row" ? 16 : 8 }}
    >
      {showWatch ? (
        <ActionButton
          backgroundClassName="bg-golden-yellow"
          icon={
            <PlaySolidIcon
              color={theme.colors["dark-slate-blue"]}
              height={ICON_SIZE}
              width={ICON_SIZE}
            />
          }
          label={watchLabel}
          labelClassName="text-dark-slate-blue"
          onPress={onWatch}
          testID={watchTestID}
          textSizeClassName={textSizeClassName}
          width={buttonWidth}
        />
      ) : null}
      {showSecondary ? (
        <ActionButton
          backgroundClassName="bg-transparent-white-10"
          icon={secondaryIcon}
          label={secondaryLabel}
          labelClassName="text-white"
          onPress={onSecondary}
          testID={secondaryTestID}
          textSizeClassName={textSizeClassName}
          width={buttonWidth}
        />
      ) : null}
    </View>
  );
}
