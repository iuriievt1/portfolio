import { View } from "react-native";
import { Text } from "@/components";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { errorCodes, showErrorModal } from "@/infra/error";
import { openExternalUrl } from "@/utils/external-url";
import { PageTitle } from "./page-title";

type LegalPageProps = {
  title: string;
  // Link text from Figma. It can differ from the canonical url it opens.
  label: string;
  url: string;
};

// A legal page: one line of text and a link that opens the document in the device browser.
export function LegalPage({ label, title, url }: LegalPageProps) {
  const { isTablet } = useDeviceLayout();
  const textSize = isTablet ? "text-[18px]" : "text-[14px]";

  const openLink = async () => {
    const hasOpened = await openExternalUrl({
      tags: { area: "my-bfbs", operation: "open_legal_page", page: title },
      url,
    });

    if (!hasOpened) {
      showErrorModal(errorCodes.unexpected);
    }
  };

  return (
    <View className={isTablet ? "gap-6" : "gap-4"} testID="legal-page">
      <View className="gap-2">
        <PageTitle>{title}</PageTitle>
        <Text className={`${textSize} text-oatmeal`}>
          To view our {title}, please visit:
        </Text>
      </View>
      <Text
        accessibilityHint={`Opens the ${title} in your browser`}
        accessibilityRole="link"
        className={`${textSize} self-start text-cyan underline`}
        onPress={() => void openLink()}
        testID="legal-page-link"
      >
        {label}
      </Text>
    </View>
  );
}
