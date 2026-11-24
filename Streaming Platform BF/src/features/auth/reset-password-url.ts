import { getRequiredEnvironmentValue } from "@/infra/common-sdk";

/** Reads the tenant-specific Defence Gateway reset-password URL. */
export function getResetPasswordUrl() {
  return getRequiredEnvironmentValue(
    "EXPO_PUBLIC_RESET_PASSWORD_URL",
    process.env.EXPO_PUBLIC_RESET_PASSWORD_URL,
  );
}
