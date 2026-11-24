import * as ScreenOrientation from "expo-screen-orientation";
import { Dimensions } from "react-native";
import { lockPortraitOnPhone } from "@/utils/orientation";

let mockDeviceType = "phone";

jest.mock("expo-device", () => ({
  DeviceType: {
    PHONE: "phone",
    TABLET: "tablet",
  },
  get deviceType() {
    return mockDeviceType;
  },
}));

jest.mock("expo-screen-orientation", () => ({
  OrientationLock: {
    LANDSCAPE: "landscape",
    PORTRAIT_UP: "portrait-up",
  },
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
}));

const PHONE_PORTRAIT = { fontScale: 2, height: 844, scale: 3, width: 390 };
const PHONE_LANDSCAPE = { fontScale: 2, height: 390, scale: 3, width: 844 };
const TABLET_LANDSCAPE = { fontScale: 2, height: 800, scale: 2, width: 1280 };

describe("lockPortraitOnPhone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeviceType = "phone";
    jest.spyOn(Dimensions, "get").mockReturnValue(PHONE_PORTRAIT);
  });

  test("locks portrait on a phone", async () => {
    await lockPortraitOnPhone();

    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith("portrait-up");
  });

  test("locks portrait on a phone launched in landscape", async () => {
    jest.spyOn(Dimensions, "get").mockReturnValue(PHONE_LANDSCAPE);

    await lockPortraitOnPhone();

    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith("portrait-up");
  });

  test("does not lock on a tablet", async () => {
    mockDeviceType = "tablet";
    jest.spyOn(Dimensions, "get").mockReturnValue(TABLET_LANDSCAPE);

    await lockPortraitOnPhone();

    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });

  test("does not lock on a tablet-sized screen with unknown device type", async () => {
    mockDeviceType = "unknown";
    jest.spyOn(Dimensions, "get").mockReturnValue(TABLET_LANDSCAPE);

    await lockPortraitOnPhone();

    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });
});
