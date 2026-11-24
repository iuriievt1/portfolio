import type { ReactNode, Ref } from "react";
import { Pressable, type PressableProps, type View } from "react-native";

import { Text } from "./text";

type ButtonVariant =
  | "pill"
  | "primary"
  | "transparent"
  | "icon"
  | "action"
  | "row"
  | "link";

type CommonButtonProps = Omit<PressableProps, "children"> & {
  buttonRef?: Ref<View>;
  className?: string;
};

type PillButtonProps = CommonButtonProps & {
  variant?: "pill";
  children: string;
  labelClassName?: string;
};

type PrimaryButtonProps = CommonButtonProps & {
  variant: "primary";
  children: string;
  labelClassName?: string;
};

type TransparentButtonProps = CommonButtonProps & {
  variant: "transparent";
  children: string;
  labelClassName?: string;
};

type IconButtonProps = CommonButtonProps & {
  variant: "icon";
  children: ReactNode;
};

type ActionButtonProps = CommonButtonProps & {
  variant: "action";
  icon: ReactNode;
  children: string;
  labelClassName?: string;
};

type RowButtonProps = CommonButtonProps & {
  variant: "row";
  children: ReactNode;
};

type LinkButtonProps = CommonButtonProps & {
  variant: "link";
  children: string;
  labelClassName?: string;
};

export type ButtonProps =
  | PillButtonProps
  | PrimaryButtonProps
  | TransparentButtonProps
  | IconButtonProps
  | ActionButtonProps
  | RowButtonProps
  | LinkButtonProps;

const variantClassName: Record<ButtonVariant, string> = {
  action: "min-h-7 flex-row items-center justify-center gap-2 px-1",
  icon: "items-center justify-center",
  link: "self-start",
  pill: "self-start items-center justify-center gap-2 rounded-full border-2 border-white bg-grey-90 px-6 py-4",
  primary: "items-center justify-center rounded-full bg-golden-yellow",
  row: "border-b border-transparent-white-10 px-3 py-4",
  transparent:
    "h-[45px] items-center justify-center rounded-full bg-transparent-white-10",
};

const DEFAULT_LABEL_CLASSNAME = "text-white";

const variantLabelClassName: Partial<Record<ButtonVariant, string>> = {
  primary: "text-dark-slate-blue",
};

/** Renders a shared accessible action in the requested visual variant. */
export function Button(props: ButtonProps) {
  const {
    variant = "pill",
    buttonRef,
    className,
    children,
    icon,
    labelClassName,
    ...pressableProps
  } = props as CommonButtonProps & {
    variant?: ButtonVariant;
    children: ReactNode;
    icon?: ReactNode;
    labelClassName?: string;
  };

  const pressableClassName = [variantClassName[variant], className]
    .filter(Boolean)
    .join(" ");
  const resolvedLabelClassName =
    labelClassName ?? variantLabelClassName[variant] ?? DEFAULT_LABEL_CLASSNAME;

  let content: ReactNode;

  if (variant === "icon" || variant === "row") {
    content = children;
  } else if (variant === "action") {
    content = (
      <>
        {icon}
        <Text
          className={`text-[14px] leading-[18px] ${resolvedLabelClassName}`}
          weight="medium"
        >
          {children}
        </Text>
      </>
    );
  } else {
    content = (
      <Text className={resolvedLabelClassName} weight="semibold">
        {children}
      </Text>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      className={pressableClassName}
      ref={buttonRef}
      {...pressableProps}
    >
      {content}
    </Pressable>
  );
}
