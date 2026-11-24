import { getDeviceTimeZone } from "@/utils/date-time";

export const TIME_ZONE_PREFERENCE = {
  DEVICE: "device",
  UK: "uk",
} as const;

export type TimeZonePreference =
  (typeof TIME_ZONE_PREFERENCE)[keyof typeof TIME_ZONE_PREFERENCE];

/** IANA zone used for UK time, including automatic GMT/BST changes. */
export const UK_TIME_ZONE = "Europe/London";

/** Resolves the selected listing time zone without changing source timestamps. */
export function getListingTimeZone(preference: TimeZonePreference) {
  return preference === TIME_ZONE_PREFERENCE.UK
    ? UK_TIME_ZONE
    : getDeviceTimeZone();
}
