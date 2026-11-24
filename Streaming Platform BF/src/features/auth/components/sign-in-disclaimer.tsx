import * as WebBrowser from "expo-web-browser";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ScreenBackground, Text } from "@/components";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { reportError } from "@/infra/error";
import { capLeading } from "@/utils/typography";
import {
  AUTH_BUTTON_LABEL_CLASSNAME,
  getScreenVariant,
} from "../screen-variant";
import { AuthLogo } from "./auth-logo";

export const TERMS_AND_CONDITIONS_URL =
  "https://about.bfbs.com/bfbstvplayer-terms-and-conditions";

const DISCLAIMER_TITLE = "Before you sign in";

const DISCLAIMER_PARAGRAPHS = [
  "Only entitled BFBS users can access this service.",
  "Access is monitored to ensure authorised and legitimate use.",
  "Suspected misuse will be investigated and acted upon.",
];

const COPY_COLUMN_WIDTH = 741;

const BUTTON_HEIGHT = 45;
const TERMS_SIZE = 14;
const GAP_LOGO_TO_TITLE = 80;
const GAP_TITLE_TO_COPY = 32;
const GAP_BUTTON_TO_TERMS = 16;

const tabletShared = {
  copyGap: 24,
  copyLineHeight: 26,
  copySize: 20,
  gapCopyToButton: 40,
  paddingLeft: 40,
  paddingRight: 40,
  screenPadding: 40,
  titleSize: 28,
} as const;

const layouts = {
  mobile: {
    buttonWidth: 155,
    copyGap: 18,
    copyLineHeight: 18,
    copySize: 14,
    gapCopyToButton: 20,
    paddingLeft: 15,
    paddingRight: 16,
    screenPadding: 24,
    titleSize: 18,
  },
  "tablet-landscape": { ...tabletShared, buttonWidth: 263 },
  "tablet-portrait": { ...tabletShared, buttonWidth: 174 },
} as const;

const TERMS_MARGIN_TOP = GAP_BUTTON_TO_TERMS - capLeading(TERMS_SIZE);

function openTermsAndConditions() {
  void WebBrowser.openBrowserAsync(TERMS_AND_CONDITIONS_URL).catch(reportError);
}

/** Rules before sign-in. */
export function SignInDisclaimer({ onContinue }: { onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet } = useDeviceLayout();

  const variant = getScreenVariant({ isLandscape, isTablet });
  const layout = layouts[variant];

  const titleMarginTop = GAP_LOGO_TO_TITLE - capLeading(layout.titleSize);
  const copyMarginTop =
    GAP_TITLE_TO_COPY -
    capLeading(layout.titleSize) -
    capLeading(layout.copySize);
  const buttonMarginTop = layout.gapCopyToButton - capLeading(layout.copySize);

  return (
    <View className="flex-1 bg-dark-slate-blue">
      <ScreenBackground />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingBottom: insets.bottom + layout.screenPadding,
          paddingTop: insets.top + layout.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
        testID="sign-in-disclaimer"
      >
        <AuthLogo variant={variant} />

        <View
          style={{
            paddingLeft: layout.paddingLeft,
            paddingRight: layout.paddingRight,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              maxWidth: COPY_COLUMN_WIDTH,
              width: "100%",
            }}
            testID="sign-in-disclaimer-content"
          >
            <Text
              className="text-white"
              style={{ fontSize: layout.titleSize, marginTop: titleMarginTop }}
              weight="bold"
            >
              {DISCLAIMER_TITLE}
            </Text>

            <View style={{ gap: layout.copyGap, marginTop: copyMarginTop }}>
              {DISCLAIMER_PARAGRAPHS.map((paragraph) => (
                <Text
                  className="text-oatmeal"
                  key={paragraph}
                  style={{
                    fontSize: layout.copySize,
                    lineHeight: layout.copyLineHeight,
                  }}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View className="items-center" style={{ marginTop: buttonMarginTop }}>
          <Button
            labelClassName={AUTH_BUTTON_LABEL_CLASSNAME[variant]}
            onPress={onContinue}
            style={{ height: BUTTON_HEIGHT, width: layout.buttonWidth }}
            testID="sign-in-disclaimer-continue"
            variant="primary"
          >
            Continue
          </Button>

          <Button
            accessibilityRole="link"
            className="self-center"
            hitSlop={16}
            labelClassName="font-bold text-[14px] text-white underline"
            onPress={openTermsAndConditions}
            style={{ marginTop: TERMS_MARGIN_TOP }}
            testID="sign-in-disclaimer-terms"
            variant="link"
          >
            Terms & Conditions
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
