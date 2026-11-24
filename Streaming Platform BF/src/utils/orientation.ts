import { Dimensions } from "react-native";
import { reportError } from "@/infra/error";
import { isTabletDevice } from "@/utils/device-layout";
import { getExpoScreenOrientationModule } from "@/utils/expo-native-modules";

/** Locks portrait on phones. */
export function lockPortraitOnPhone() {
  const { height, width } = Dimensions.get("window");

  if (isTabletDevice({ height, width })) {
    return;
  }

  const ScreenOrientation = getExpoScreenOrientationModule();

  return ScreenOrientation.lockAsync(
    ScreenOrientation.OrientationLock.PORTRAIT_UP,
  ).catch((error: unknown) => {
    reportError(error);
  });
}
