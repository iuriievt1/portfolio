import { DeviceManager } from "@bfbs/common-sdk";

/** True only when a fresh quota read shows the household is full (AUTH_021). */
export async function isDeviceQuotaReached() {
  try {
    const { devices, maxDeviceCount } = await DeviceManager.getDeviceLimits();
    // No max means the household has no limit.
    return maxDeviceCount !== undefined && devices.length >= maxDeviceCount;
  } catch {
    return false;
  }
}
