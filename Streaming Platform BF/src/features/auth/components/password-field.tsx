import type { Ref } from "react";
import { type TextInput, View } from "react-native";

import EyeIcon from "@/assets/icons/eye-icon.svg";
import EyeOffIcon from "@/assets/icons/eye-off-icon.svg";
import {
  Button,
  TEXT_FIELD_HEIGHT,
  TEXT_FIELD_IDLE_CLASSNAME,
  TextField,
} from "@/components";
import { theme } from "@/theme/theme";

const PLACEHOLDER = "Password";
const VISIBILITY_BUTTON_WIDTH = 52;
const VISIBILITY_ICON_SIZE = 20;
const FIELD_ROW_GAP = 4;

const VISIBILITY_ACTIONS = {
  hide: {
    Icon: EyeOffIcon,
    color: theme.colors["transparent-white-60"],
    label: "Hide password",
  },
  show: { Icon: EyeIcon, color: theme.colors.white, label: "Show password" },
};

interface PasswordFieldProps {
  hasError: boolean;
  isHidden: boolean;
  marginTop: number;
  onChangeText: (value: string) => void;
  onSubmitEditing: () => void;
  onToggleVisibility: () => void;
  ref: Ref<TextInput>;
  value: string;
}

/** Password entry with its show and hide toggle. */
export function PasswordField({
  hasError,
  isHidden,
  marginTop,
  onChangeText,
  onSubmitEditing,
  onToggleVisibility,
  ref,
  value,
}: PasswordFieldProps) {
  const action = isHidden ? "show" : "hide";
  const { Icon, color, label } = VISIBILITY_ACTIONS[action];

  return (
    <View className="flex-row" style={{ gap: FIELD_ROW_GAP, marginTop }}>
      <TextField
        autoCapitalize="none"
        autoComplete="current-password"
        autoCorrect={false}
        className="flex-1"
        hasError={hasError}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={PLACEHOLDER}
        ref={ref}
        returnKeyType="go"
        secureTextEntry={isHidden}
        testID="sign-in-password"
        textContentType="password"
        value={value}
      />

      <Button
        accessibilityLabel={label}
        className={TEXT_FIELD_IDLE_CLASSNAME}
        onPress={onToggleVisibility}
        style={{ height: TEXT_FIELD_HEIGHT, width: VISIBILITY_BUTTON_WIDTH }}
        testID="sign-in-password-visibility"
        variant="icon"
      >
        <Icon
          color={color}
          height={VISIBILITY_ICON_SIZE}
          testID={`sign-in-password-${action}-icon`}
          width={VISIBILITY_ICON_SIZE}
        />
      </Button>
    </View>
  );
}
