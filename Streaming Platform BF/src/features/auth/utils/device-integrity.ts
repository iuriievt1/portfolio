import { DeviceIntegrity, DeviceIntegrityStatus } from "@bfbs/common-sdk";
import { Platform } from "react-native";
import { reportError } from "@/infra/error";
import { featureFlagKeys } from "@/infra/feature-flags/feature-keys";
import { featurevisorService } from "@/infra/feature-flags/featurevisor-service";

/** Matches CTV: checks are enabled unless the feature flag explicitly disables them. */
export function isDeviceIntegrityEnabled(): boolean {
  return (
    featurevisorService.isEnabled(featureFlagKeys.deviceIntegrity, {}, true) ??
    true
  );
}

async function checkNativeIntegrity(): Promise<boolean> {
  try {
    const result = await DeviceIntegrity.check();
    return result.status !== DeviceIntegrityStatus.FAILED;
  } catch (error) {
    reportError(error, {
      tags: { area: "auth", operation: "device_integrity_check" },
    });
    console.warn("Device integrity check unavailable; allowing access.");
    return true;
  }
}

/** Applies the current flag, discarding checks started before an enforcement change. */
export async function isDeviceIntegrityAllowed(): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return true;
  }

  while (isDeviceIntegrityEnabled()) {
    let changed = false;
    let notifyChange!: () => void;
    const policyChange = new Promise<undefined>((resolve) => {
      notifyChange = () => resolve(undefined);
    });
    const unsubscribe = featurevisorService.subscribe(() => {
      if (!isDeviceIntegrityEnabled()) {
        changed = true;
        notifyChange();
      }
    });

    try {
      // A remote disable releases the flow without waiting for the native timeout.
      const allowed = await Promise.race([
        checkNativeIntegrity(),
        policyChange,
      ]);
      if (!changed && allowed !== undefined) {
        return allowed;
      }
    } finally {
      unsubscribe();
    }
  }
  return true;
}
