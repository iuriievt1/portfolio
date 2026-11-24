import { type Ref, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";

import { theme } from "@/theme/theme";

export const TEXT_FIELD_HEIGHT = 48;
const TEXT_FIELD_FONT_SIZE = 14;
const TEXT_FIELD_PADDING_HORIZONTAL = 20;
const TEXT_FIELD_PADDING_VERTICAL = 8;

const SURFACE_CLASSNAME = "rounded-lg border bg-black/40";

export const TEXT_FIELD_IDLE_CLASSNAME = `${SURFACE_CLASSNAME} border-transparent-white-10`;

type TextFieldProps = TextInputProps & {
  className?: string;
  hasError?: boolean;
  ref?: Ref<TextInput>;
  surface?: "default" | "bare";
};

function getSurfaceClassName({
  hasError,
  isFocused,
}: {
  hasError: boolean;
  isFocused: boolean;
}) {
  if (hasError) {
    return `${SURFACE_CLASSNAME} border-red`;
  }

  return isFocused
    ? `${SURFACE_CLASSNAME} border-golden-yellow`
    : TEXT_FIELD_IDLE_CLASSNAME;
}

/** Shared text field with the app's default focus and error treatment. */
export function TextField({
  className,
  hasError = false,
  onBlur,
  onFocus,
  placeholderTextColor = theme.colors["transparent-white-60"],
  ref,
  style,
  surface = "default",
  ...props
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const fieldClassName = [
    surface === "default"
      ? getSurfaceClassName({ hasError, isFocused })
      : undefined,
    "text-white",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TextInput
      {...props}
      className={fieldClassName}
      onBlur={(event) => {
        if (surface === "default") {
          setIsFocused(false);
        }
        onBlur?.(event);
      }}
      onFocus={(event) => {
        if (surface === "default") {
          setIsFocused(true);
        }
        onFocus?.(event);
      }}
      placeholderTextColor={placeholderTextColor}
      ref={ref}
      style={[
        {
          fontFamily: theme.fontFamily["euclid-regular"],
          fontSize: TEXT_FIELD_FONT_SIZE,
          height: TEXT_FIELD_HEIGHT,
          includeFontPadding: false,
          paddingHorizontal: TEXT_FIELD_PADDING_HORIZONTAL,
          paddingVertical: TEXT_FIELD_PADDING_VERTICAL,
        },
        style,
      ]}
    />
  );
}
