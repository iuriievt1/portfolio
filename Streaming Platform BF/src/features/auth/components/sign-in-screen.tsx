import type { SignInInput } from "@bfbs/common-sdk";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ScreenBackground, Text, TextField } from "@/components";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { errorCodes, showErrorModal } from "@/infra/error";
import { openExternalUrl } from "@/utils/external-url";
import { capLeading } from "@/utils/typography";
import { useSignInForm } from "../hooks/use-sign-in-form";
import { getResetPasswordUrl } from "../reset-password-url";
import {
  AUTH_BUTTON_LABEL_CLASSNAME,
  getScreenVariant,
} from "../screen-variant";
import { AuthLogo } from "./auth-logo";
import { PasswordField } from "./password-field";

const SCREEN_TITLE = "Sign In";
const SCREEN_SUBTITLE = "Please enter your Defence Gateway credentials";
const USERNAME_PLACEHOLDER = "Username or Service/Staff Number";

const TITLE_SIZE = 28;
const ERROR_SIZE = 14;
const GAP_TITLE_TO_SUBTITLE = 32;
const GAP_SUBTITLE_TO_FIELDS = 32;
const GAP_FIELD_TO_FIELD = 16;
const GAP_FIELDS_TO_BUTTON = 42;
const SCREEN_BOTTOM_PADDING = 24;

const tabletShared = {
  buttonHeight: 45,
  forgotPasswordClassName: "font-bold text-[16px] text-white underline",
  forgotPasswordSize: 16,
  gapErrorToButton: 22,
  gapFieldToError: 10,
  gapLogoToTitle: 80,
  headlineClassName: "text-left",
  screenPadding: 40,
  subtitleSize: 20,
} as const;

async function openResetPassword() {
  const hasOpened = await openExternalUrl({
    tags: { area: "auth", operation: "reset_password" },
    url: getResetPasswordUrl(),
  });

  if (!hasOpened) {
    showErrorModal(errorCodes.unexpected);
  }
}

const layouts = {
  mobile: {
    buttonHeight: 42,
    buttonWidth: "100%",
    columnWidth: undefined,
    forgotPasswordClassName: "font-bold text-[14px] text-white underline",
    forgotPasswordSize: 14,
    gapButtonToForgotPassword: 16,
    gapErrorToButton: 16,
    gapFieldToError: 16,
    gapLogoToTitle: 50,
    headlineClassName: "text-center",
    logoTop: 31,
    screenPadding: 16,
    subtitleSize: 14,
  },
  "tablet-landscape": {
    ...tabletShared,
    buttonWidth: 263,
    columnWidth: 685,
    gapButtonToForgotPassword: 16,
    logoTop: 62,
  },
  "tablet-portrait": {
    ...tabletShared,
    buttonWidth: 174,
    columnWidth: 740,
    gapButtonToForgotPassword: 20,
    logoTop: 205,
  },
} as const;

type SignInScreenProps = {
  /** The inline failure the error table prints under the fields. */
  errorMessage?: string | undefined;
  isSubmitting: boolean;
  onSubmit: (credentials: SignInInput) => void;
};

/** Defence Gateway credentials form. */
export function SignInScreen({
  errorMessage,
  isSubmitting,
  onSubmit,
}: SignInScreenProps) {
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet } = useDeviceLayout();
  const {
    focusPassword,
    isPasswordHidden,
    password,
    passwordRef,
    setPassword,
    setUsername,
    submit,
    togglePasswordVisibility,
    username,
  } = useSignInForm({ isSubmitting, onSubmit });

  const variant = getScreenVariant({ isLandscape, isTablet });
  const layout = layouts[variant];
  const hasError = Boolean(errorMessage);

  const buttonMarginTop = hasError
    ? layout.gapErrorToButton - capLeading(ERROR_SIZE)
    : GAP_FIELDS_TO_BUTTON;

  return (
    <View className="flex-1 bg-dark-slate-blue">
      <ScreenBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + SCREEN_BOTTOM_PADDING,
            paddingHorizontal: layout.screenPadding,
            paddingTop: insets.top + layout.logoTop,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID="sign-in-screen"
        >
          <View
            style={{
              alignSelf: "center",
              maxWidth: layout.columnWidth,
              width: "100%",
            }}
            testID="sign-in-content"
          >
            <AuthLogo variant={variant} />

            <Text
              className={`text-white ${layout.headlineClassName}`}
              style={{
                fontSize: TITLE_SIZE,
                marginTop: layout.gapLogoToTitle - capLeading(TITLE_SIZE),
              }}
              weight="bold"
            >
              {SCREEN_TITLE}
            </Text>

            <Text
              className={`text-oatmeal ${layout.headlineClassName}`}
              style={{
                fontSize: layout.subtitleSize,
                marginTop:
                  GAP_TITLE_TO_SUBTITLE -
                  capLeading(TITLE_SIZE) -
                  capLeading(layout.subtitleSize),
              }}
            >
              {SCREEN_SUBTITLE}
            </Text>

            <TextField
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              hasError={hasError}
              onChangeText={setUsername}
              onSubmitEditing={focusPassword}
              placeholder={USERNAME_PLACEHOLDER}
              returnKeyType="next"
              style={{
                marginTop:
                  GAP_SUBTITLE_TO_FIELDS - capLeading(layout.subtitleSize),
              }}
              testID="sign-in-username"
              textContentType="username"
              value={username}
            />

            <PasswordField
              hasError={hasError}
              isHidden={isPasswordHidden}
              marginTop={GAP_FIELD_TO_FIELD}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              onToggleVisibility={togglePasswordVisibility}
              ref={passwordRef}
              value={password}
            />

            {hasError ? (
              <Text
                className="text-red"
                style={{
                  fontSize: ERROR_SIZE,
                  marginTop: layout.gapFieldToError - capLeading(ERROR_SIZE),
                }}
                testID="sign-in-error"
              >
                {errorMessage}
              </Text>
            ) : null}

            <View
              className="items-center"
              style={{ marginTop: buttonMarginTop }}
            >
              <Button
                disabled={isSubmitting}
                labelClassName={AUTH_BUTTON_LABEL_CLASSNAME[variant]}
                onPress={submit}
                style={{
                  height: layout.buttonHeight,
                  width: layout.buttonWidth,
                }}
                testID="sign-in-continue"
                variant="primary"
              >
                Continue
              </Button>

              <Button
                accessibilityRole="link"
                className="self-center"
                labelClassName={layout.forgotPasswordClassName}
                onPress={openResetPassword}
                style={{
                  marginTop:
                    layout.gapButtonToForgotPassword -
                    capLeading(layout.forgotPasswordSize),
                }}
                testID="sign-in-forgot-password"
                variant="link"
              >
                Forgot Password
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
