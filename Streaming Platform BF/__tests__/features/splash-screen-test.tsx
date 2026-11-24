import { fireEvent, render } from "@testing-library/react-native";
import { DeviceType } from "expo-device";

import {
  getSplashScreenVariant,
  SplashScreen,
  type SplashScreenVariant,
} from "@/features/splash-screen";

jest.mock("expo-image", () => {
  const { Image } = require("react-native");

  return { Image };
});

describe("getSplashScreenVariant", () => {
  test.each<
    [
      width: number,
      height: number,
      deviceType: DeviceType | null,
      expectedVariant: SplashScreenVariant,
    ]
  >([
    [390, 844, DeviceType.PHONE, "mobile"],
    [844, 390, DeviceType.PHONE, "mobile"],
    [744, 1133, DeviceType.TABLET, "tablet-portrait"],
    [1133, 744, DeviceType.TABLET, "tablet-landscape"],
    [820, 1180, null, "tablet-portrait"],
    [1180, 820, null, "tablet-landscape"],
  ])("returns %s for a %ix%i screen", (width, height, deviceType, expectedVariant) => {
    expect(
      getSplashScreenVariant({
        width,
        height,
        deviceType,
      }),
    ).toBe(expectedVariant);
  });
});

describe("<SplashScreen />", () => {
  test("renders the splash artwork image", () => {
    const { getByTestId } = render(<SplashScreen />);

    expect(getByTestId("splash-screen-image").props.source).toBe(
      require("../../assets/images/splash-screen-mobile.png"),
    );
  });

  test("marks the splash as ready when the artwork loads", () => {
    const onReady = jest.fn();
    const { getByTestId } = render(<SplashScreen onReady={onReady} />);

    fireEvent(getByTestId("splash-screen-image"), "load");

    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
