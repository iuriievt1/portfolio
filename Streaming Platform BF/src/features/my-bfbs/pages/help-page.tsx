import { View } from "react-native";
import { Text } from "@/components";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { formatAppVersion, getAppVersionMetadata } from "@/infra/app-version";
import { errorCodes, showErrorModal } from "@/infra/error";
import { openExternalUrl } from "@/utils/external-url";
import { PageTitle } from "../components/page-title";

const HELP_URL = "https://www.bfbs.com/help";
const HELP_LABEL = "bfbs.com/help";
const SUPPORT_EMAIL = "Service.Delivery@bfbs.com";
const SUPPORT_PHONE = "+44 (0) 20 3750 4567";
const SUPPORT_PHONE_URL = "tel:+442037504567";
const LINK_CLASS_NAME = "text-cyan underline";

// Opens the browser, mail or phone app, or shows an error if it can't.
async function openLink(url: string) {
  const hasOpened = await openExternalUrl({
    tags: { area: "my-bfbs", operation: "open_help_link" },
    url,
  });

  if (!hasOpened) {
    showErrorModal(errorCodes.unexpected);
  }
}

// Help: how to contact BFBS, and the app version to quote to support.
export function HelpPage() {
  const { isTablet } = useDeviceLayout();
  const textClassName = `${isTablet ? "text-[18px]" : "text-[14px]"} text-oatmeal`;

  return (
    <View className="gap-6" testID="help-page">
      <View className={isTablet ? "gap-6" : "gap-4"}>
        <View className="gap-2">
          <PageTitle>Help</PageTitle>
          <Text className={textClassName}>
            To get help please visit{" "}
            <Text
              accessibilityHint="Opens BFBS help in your browser"
              accessibilityRole="link"
              className={LINK_CLASS_NAME}
              onPress={() => void openLink(HELP_URL)}
            >
              {HELP_LABEL}
            </Text>
            ,
          </Text>
        </View>
        <Text className={textClassName}>
          Alternatively, you can{"\n"}email{" "}
          <Text
            accessibilityHint="Opens your email app"
            accessibilityRole="link"
            className={LINK_CLASS_NAME}
            onPress={() => void openLink(`mailto:${SUPPORT_EMAIL}`)}
          >
            {SUPPORT_EMAIL}
          </Text>
          {"\n"}or call{" "}
          <Text
            accessibilityHint="Opens your phone app"
            accessibilityRole="link"
            className={LINK_CLASS_NAME}
            onPress={() => void openLink(SUPPORT_PHONE_URL)}
          >
            {SUPPORT_PHONE}
          </Text>
        </Text>
        <Text className={textClassName}>
          Please note, that phone lines are open Monday to Friday 0600-2000 UK
          time excluding public holidays.
        </Text>
      </View>
      <Text className={textClassName}>
        App Version: {formatAppVersion(getAppVersionMetadata())}
      </Text>
    </View>
  );
}
