import { ActionLogonResult, EventType } from "@bfbs/common-sdk";
import { reportError } from "@/infra/error";
import { analyticsManager } from "./analytics-manager";

// A failure is reported, never thrown, so auth carries on.
function trackLogon(result: ActionLogonResult) {
  try {
    analyticsManager.track({ type: EventType.ACTION_LOGON, data: { result } });
  } catch (error) {
    reportError(error, {
      tags: { area: "analytics", operation: "track_logon" },
    });
  }
}

/** Sends LOGON_SUCCESS after a user sign-in. */
export function trackSignIn() {
  trackLogon(ActionLogonResult.LOGON_SUCCESS);
}

/** Sends LOGOUT_SUCCESS after a user sign-out. */
export function trackSignOut() {
  trackLogon(ActionLogonResult.LOGOUT_SUCCESS);
}
