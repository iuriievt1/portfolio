import { act, renderHook } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { useErrorAction } from "@/infra/error";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: "com.bfbs.player" } } },
}));

jest.mock("expo-linking", () => ({ openURL: jest.fn() }));

const originalPlatformOs = Platform.OS;

function setPlatform(os: "android" | "ios") {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os });
}

describe("useErrorAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Linking.openURL).mockResolvedValue(true);
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOs,
    });
    process.env.EXPO_PUBLIC_IOS_APP_STORE_ID = undefined;
    process.env.EXPO_PUBLIC_ANDROID_APP_ID = "";
  });

  test("sends Android to the listing for the id the build ships with", async () => {
    setPlatform("android");

    const { result } = renderHook(() => useErrorAction({}));

    await act(async () => {
      result.current("updateApp");
    });

    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://play.google.com/store/apps/details?id=com.bfbs.player",
    );
  });

  test("prefers the Android listing id from the environment", async () => {
    setPlatform("android");
    process.env.EXPO_PUBLIC_ANDROID_APP_ID = "com.bfbs.player.release";

    const { result } = renderHook(() => useErrorAction({}));

    await act(async () => {
      result.current("updateApp");
    });

    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://play.google.com/store/apps/details?id=com.bfbs.player.release",
    );
  });

  test("sends iOS to the App Store id from the environment", async () => {
    setPlatform("ios");
    process.env.EXPO_PUBLIC_IOS_APP_STORE_ID = "123456789";

    const { result } = renderHook(() => useErrorAction({}));

    await act(async () => {
      result.current("updateApp");
    });

    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://apps.apple.com/app/id123456789",
    );
  });

  test("opens nothing when the store listing is unknown", async () => {
    setPlatform("ios");
    process.env.EXPO_PUBLIC_IOS_APP_STORE_ID = "";

    const { result } = renderHook(() => useErrorAction({}));

    await act(async () => {
      result.current("updateApp");
    });

    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  test("hands every other verb back to the caller", () => {
    const onCancel = jest.fn();
    const onRetry = jest.fn();

    const { result } = renderHook(() => useErrorAction({ onCancel, onRetry }));

    act(() => {
      result.current("retry");
      result.current("back");
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
