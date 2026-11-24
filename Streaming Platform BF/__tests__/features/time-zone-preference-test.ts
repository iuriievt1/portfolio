import { act, renderHook } from "@testing-library/react-native";
import {
  getListingTimeZone,
  TIME_ZONE_PREFERENCE,
  UK_TIME_ZONE,
} from "@/features/my-bfbs/time-zone-preference";
import {
  configureTimeZonePreferencePersistence,
  setTimeZonePreference,
  useTimeZonePreference,
} from "@/features/my-bfbs/time-zone-preference-store";

describe("time-zone preference", () => {
  beforeEach(async () => {
    await configureTimeZonePreferencePersistence();
  });

  test("defaults to device time", () => {
    const { result } = renderHook(useTimeZonePreference);

    expect(result.current).toBe(TIME_ZONE_PREFERENCE.DEVICE);
    expect(getListingTimeZone(result.current)).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  test("makes a selected value available through the shared owner", () => {
    setTimeZonePreference(TIME_ZONE_PREFERENCE.UK);
    const { result } = renderHook(useTimeZonePreference);

    expect(result.current).toBe(TIME_ZONE_PREFERENCE.UK);
    expect(getListingTimeZone(result.current)).toBe(UK_TIME_ZONE);
  });

  test("hydrates and saves through an account persistence adapter", async () => {
    const save = jest.fn().mockResolvedValue(undefined);

    await configureTimeZonePreferencePersistence({
      load: jest.fn().mockResolvedValue(TIME_ZONE_PREFERENCE.UK),
      save,
    });

    const { result } = renderHook(useTimeZonePreference);
    expect(result.current).toBe(TIME_ZONE_PREFERENCE.UK);

    act(() => {
      setTimeZonePreference(TIME_ZONE_PREFERENCE.DEVICE);
    });
    expect(save).toHaveBeenCalledWith(TIME_ZONE_PREFERENCE.DEVICE);
  });

  test("ignores a stale load when persistence is reconfigured", async () => {
    let resolveFirstLoad:
      | ((preference: typeof TIME_ZONE_PREFERENCE.DEVICE) => void)
      | undefined;
    const firstLoad = new Promise<typeof TIME_ZONE_PREFERENCE.DEVICE>(
      (resolve) => {
        resolveFirstLoad = resolve;
      },
    );
    const firstConfiguration = configureTimeZonePreferencePersistence({
      load: () => firstLoad,
      save: jest.fn(),
    });

    await configureTimeZonePreferencePersistence({
      load: jest.fn().mockResolvedValue(TIME_ZONE_PREFERENCE.UK),
      save: jest.fn(),
    });

    if (!resolveFirstLoad) {
      throw new Error("Expected the first preference load to be pending.");
    }

    resolveFirstLoad(TIME_ZONE_PREFERENCE.DEVICE);
    await firstConfiguration;

    const { result } = renderHook(useTimeZonePreference);
    expect(result.current).toBe(TIME_ZONE_PREFERENCE.UK);
  });
});
