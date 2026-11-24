import { useEffect } from "react";
import { BackHandler, View } from "react-native";
import { MyBfbsMobileMenu } from "./my-bfbs-mobile-menu";

type MyBfbsMenuOverlayProps = {
  bottomOffset: number;
  onClose: () => void;
};

export function MyBfbsMenuOverlay({
  bottomOffset,
  onClose,
}: MyBfbsMenuOverlayProps) {
  useEffect(() => {
    // Android back closes the menu instead of leaving the current tab.
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );

    return () => subscription.remove();
  }, [onClose]);

  return (
    <View className="absolute inset-x-0 top-0" style={{ bottom: bottomOffset }}>
      <MyBfbsMobileMenu onClose={onClose} />
    </View>
  );
}
