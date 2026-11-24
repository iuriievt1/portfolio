import { isDeviceNotRegisteredError } from "@bfbs/common-sdk";
import { reportError } from "@/infra/error";
import { reportDeviceRemoved } from "../device-removed-store";

/** Ends a removed device's session and reports whether it handled the error. */
export function handleDeviceRemoval(error: unknown): boolean {
  if (!isDeviceNotRegisteredError(error)) {
    return false;
  }

  // One report per removal, with the SDK error details.
  if (reportDeviceRemoved()) {
    reportError(error, { tags: { area: "auth", operation: "device_removed" } });
  }

  return true;
}
