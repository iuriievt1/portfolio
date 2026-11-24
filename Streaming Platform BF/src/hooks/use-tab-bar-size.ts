import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_CONTENT_HEIGHT = 54;
const MIN_BOTTOM_INSET = 8;

/** The bottom tab bar's full height and its bottom padding, which covers the safe area. */
export function useTabBarSize() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, MIN_BOTTOM_INSET);

  return { bottomInset, height: TAB_BAR_CONTENT_HEIGHT + bottomInset };
}
