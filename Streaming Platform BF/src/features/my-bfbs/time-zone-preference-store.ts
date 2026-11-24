import { createStore, useStore } from "zustand";
import { reportError } from "@/infra/error";
import {
  getListingTimeZone,
  TIME_ZONE_PREFERENCE,
  type TimeZonePreference,
} from "./time-zone-preference";

type TimeZonePreferenceState = {
  preference: TimeZonePreference;
};

export type TimeZonePreferencePersistence = {
  load: () => Promise<TimeZonePreference | undefined>;
  save: (preference: TimeZonePreference) => Promise<void>;
};

const timeZonePreferenceStore = createStore<TimeZonePreferenceState>(() => ({
  preference: TIME_ZONE_PREFERENCE.DEVICE,
}));

let persistence: TimeZonePreferencePersistence | undefined;
let persistenceGeneration = 0;

/**
 * Attaches account persistence and hydrates its saved value.
 * Pass no adapter on sign-out to restore the device-time default.
 */
export async function configureTimeZonePreferencePersistence(
  nextPersistence?: TimeZonePreferencePersistence,
) {
  const generation = ++persistenceGeneration;
  persistence = nextPersistence;

  if (!nextPersistence) {
    resetTimeZonePreference();
    return;
  }

  try {
    const savedPreference = await nextPersistence.load();

    if (generation !== persistenceGeneration) {
      return;
    }

    timeZonePreferenceStore.setState({
      preference: savedPreference ?? TIME_ZONE_PREFERENCE.DEVICE,
    });
  } catch (error) {
    if (generation !== persistenceGeneration) {
      return;
    }

    reportError(error, {
      tags: { area: "my_bfbs", operation: "load_time_zone_preference" },
    });
    resetTimeZonePreference();
  }
}

/** Applies a listing-time preference immediately throughout the running app. */
export function setTimeZonePreference(preference: TimeZonePreference) {
  timeZonePreferenceStore.setState({ preference });

  void persistence?.save(preference).catch((error: unknown) => {
    reportError(error, {
      tags: { area: "my_bfbs", operation: "save_time_zone_preference" },
    });
  });
}

/** Restores the default preference when no account value is available. */
export function resetTimeZonePreference() {
  timeZonePreferenceStore.setState({
    preference: TIME_ZONE_PREFERENCE.DEVICE,
  });
}

/** Returns the selected typed preference. */
export function useTimeZonePreference() {
  return useStore(timeZonePreferenceStore, (state) => state.preference);
}

/** Returns the IANA zone used by listing-time formatters. */
export function useListingTimeZone() {
  const preference = useTimeZonePreference();

  return getListingTimeZone(preference);
}
