import { View } from "react-native";

import { Text } from "@/components";
import {
  formatAppVersion,
  getAppVersionMetadata,
} from "@/infra/app-version/app-version-metadata";

/**
 * Displays the app version and environment so the team can identify
 * exactly which build they are running.
 */
export function AppVersion() {
  const metadata = getAppVersionMetadata();

  return (
    <View className="items-center gap-1 px-6 py-4">
      <Text className="text-center text-body-small text-white">
        {`App version: ${formatAppVersion(metadata)}`}
      </Text>
      <Text className="text-center text-body-small text-white">
        {`Environment: ${metadata.environment}`}
      </Text>
    </View>
  );
}
