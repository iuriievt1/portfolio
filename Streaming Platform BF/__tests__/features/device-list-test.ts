import type { RegisteredDevice } from "@bfbs/common-sdk";
import {
  getOtherDevices,
  isBrowserDevice,
  isMobileDevice,
} from "@/features/devices/device-list";

const currentPhone: RegisteredDevice = {
  displayDeviceType: "Android Mobile",
  id: "current-phone",
  registeredDateTime: "2026-09-29T10:47:36Z",
  type: "COMPANION",
};
const oldPhone: RegisteredDevice = {
  displayDeviceType: "iOS Mobile",
  id: "old-phone",
  registeredDateTime: "2026-09-16T08:34:21Z",
  type: "COMPANION",
};
const tv: RegisteredDevice = {
  displayDeviceType: "Smart TV",
  id: "tv",
  registeredDateTime: "2026-10-08T10:48:16Z",
  type: "STB",
};
const browser: RegisteredDevice = {
  displayDeviceType: "Generic Browser",
  id: "browser",
  registeredDateTime: "2026-10-08T10:16:04Z",
  type: "BROWSER",
};

function getIds(devices: RegisteredDevice[]) {
  return devices.map((device) => device.id);
}

describe("device list", () => {
  test("leaves out the current device but keeps browsers", () => {
    const others = getOtherDevices(
      [oldPhone, browser, currentPhone, tv],
      currentPhone.id,
    );

    expect(getIds(others)).toEqual(["tv", "browser", "old-phone"]);
  });

  test("orders the other devices newest first", () => {
    const others = getOtherDevices([oldPhone, tv, currentPhone], "other-id");

    expect(getIds(others)).toEqual(["tv", "current-phone", "old-phone"]);
  });

  test("puts devices with no registration date last", () => {
    const undated: RegisteredDevice = { id: "undated", type: "COMPANION" };
    const others = getOtherDevices([undated, oldPhone, tv], currentPhone.id);

    expect(getIds(others)).toEqual(["tv", "old-phone", "undated"]);
  });

  test("tells phones, TVs and browsers apart by type", () => {
    expect(isMobileDevice(currentPhone)).toBe(true);
    expect(isMobileDevice(tv)).toBe(false);
    expect(isBrowserDevice(browser)).toBe(true);
    expect(isBrowserDevice(tv)).toBe(false);
    expect(isBrowserDevice(currentPhone)).toBe(false);
  });
});
