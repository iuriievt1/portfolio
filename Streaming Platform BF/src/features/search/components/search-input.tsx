import { useRef, useState } from "react";
import {
  type BlurEvent,
  type FocusEvent,
  Keyboard,
  type TextInput as NativeTextInput,
  Pressable,
  type TextInputProps,
  type TextInputSelectionChangeEvent,
  View,
} from "react-native";

import SearchIcon from "@/assets/icons/search-icon.svg";
import { Text, TextField } from "@/components";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { theme } from "@/theme/theme";

const SEARCH_PLACEHOLDER = "Search BFBS";
const SEARCH_ICON_SIZE = 17;
const MINIMUM_TOUCH_TARGET_SIZE = 44;

type SearchInputProps = Pick<
  TextInputProps,
  "autoFocus" | "onBlur" | "onFocus"
> & {
  onChangeText: (value: string) => void;
  onSubmit?: ((value: string) => void) | undefined;
  value: string;
};

/** Controlled search field with the responsive idle and focused treatments. */
export function SearchInput({
  autoFocus,
  onBlur,
  onChangeText,
  onFocus,
  onSubmit,
  value,
}: SearchInputProps) {
  const { isTablet } = useDeviceLayout();
  const inputRef = useRef<NativeTextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >();
  const fieldHeight = isTablet ? 49 : 37;
  const fontSize = isTablet ? 18 : 13;
  const touchTargetHeight = Math.max(fieldHeight, MINIMUM_TOUCH_TARGET_SIZE);
  const surfaceClassName = [
    "rounded-lg border bg-transparent-white-10",
    isFocused ? "border-golden-yellow" : "border-transparent-white-50",
  ].join(" ");

  function focusInput() {
    inputRef.current?.focus();
  }

  function clearInput() {
    onChangeText("");
    focusInput();
  }

  function handleFocus(event: FocusEvent) {
    setIsFocused(true);
    setSelection({ end: value.length, start: value.length });
    onFocus?.(event);
  }

  function handleBlur(event: BlurEvent) {
    setIsFocused(false);
    setSelection(undefined);
    onBlur?.(event);
  }

  function onSelectionChange(event: TextInputSelectionChangeEvent) {
    if (
      selection &&
      (event.nativeEvent.selection.start !== selection.start ||
        event.nativeEvent.selection.end !== selection.end)
    ) {
      setSelection(undefined);
    }
  }

  function submitInput() {
    Keyboard.dismiss();
    onSubmit?.(value);
  }

  return (
    <Pressable
      accessible={false}
      className="relative flex-row items-center gap-[10px] px-4"
      onPress={focusInput}
      style={{ height: touchTargetHeight }}
      testID="search-input-container"
    >
      <View
        className={surfaceClassName}
        pointerEvents="none"
        style={{
          height: fieldHeight,
          left: 0,
          position: "absolute",
          right: 0,
          top: (touchTargetHeight - fieldHeight) / 2,
        }}
        testID="search-input-surface"
      />

      <SearchIcon
        color={theme.colors.white}
        height={SEARCH_ICON_SIZE}
        pointerEvents="none"
        width={SEARCH_ICON_SIZE}
      />

      <View className="relative flex-1" style={{ height: fieldHeight }}>
        <TextField
          accessibilityLabel="Search"
          accessibilityRole="search"
          accessibilityValue={{ text: value }}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          autoFocus={autoFocus}
          className="p-0"
          multiline={false}
          onBlur={handleBlur}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onSelectionChange={onSelectionChange}
          onSubmitEditing={submitInput}
          placeholder={isFocused ? SEARCH_PLACEHOLDER : undefined}
          placeholderTextColor={theme.colors["transparent-white-50"]}
          ref={inputRef}
          returnKeyType="search"
          selection={selection}
          style={{
            color: isFocused ? theme.colors.white : "transparent",
            fontFamily: theme.fontFamily["euclid-bold"],
            fontSize,
            height: fieldHeight,

            paddingHorizontal: 0,
            paddingVertical: 0,
          }}
          surface="bare"
          testID="search-input"
          value={value}
        />

        {isFocused ? null : (
          <Text
            className={value ? "text-white" : "text-transparent-white-50"}
            ellipsizeMode="tail"
            numberOfLines={1}
            pointerEvents="none"
            style={{
              fontFamily: theme.fontFamily["euclid-bold"],
              fontSize,
              left: 0,
              lineHeight: 22,
              position: "absolute",
              right: 0,
              top: (fieldHeight - 22) / 2,
            }}
            testID="search-input-collapsed-value"
          >
            {value || SEARCH_PLACEHOLDER}
          </Text>
        )}
      </View>

      <Pressable
        accessibilityLabel="Clear search"
        accessibilityRole="button"
        hitSlop={8}
        onPress={clearInput}
        style={{
          justifyContent: "center",
          minHeight: MINIMUM_TOUCH_TARGET_SIZE,
        }}
        testID="search-input-clear"
      >
        <Text
          className={`${isTablet ? "text-[16px]" : "text-[14px]"} text-white`}
          weight="normal"
        >
          Clear
        </Text>
      </Pressable>
    </Pressable>
  );
}
