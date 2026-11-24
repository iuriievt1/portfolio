import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Text } from "@/components";
import { useDeviceLayout } from "@/hooks/use-device-layout";

type ConfirmModalProps = {
  // Read out by screen readers when the modal opens.
  announcement: string;
  cancelAccessibilityLabel: string;
  confirmAccessibilityLabel: string;
  errorMessage?: string | undefined;
  // Turns Cancel off when the user can't go back.
  isCancelDisabled?: boolean | undefined;
  isPending: boolean;
  message?: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
  // Shown on Yes while the request runs.
  pendingLabel?: string | undefined;
  // Prefix for the test ids, e.g. "logout" gives "logout-confirm".
  testID: string;
  title: string;
  visible: boolean;
};

// Button and box sizes from Figma.
function getModalSize(isTablet: boolean, isLandscape: boolean) {
  if (!isTablet) {
    return { buttonClassName: "h-[45px] w-[123px]", minHeight: 249 };
  }

  return isLandscape
    ? { buttonClassName: "h-[45px] w-[263px]", minHeight: 296 }
    : { buttonClassName: "h-[45px] w-[174px]", minHeight: 369 };
}

// A Yes / Cancel question in a blocking dialog that Back can close.
export function ConfirmModal({
  announcement,
  cancelAccessibilityLabel,
  confirmAccessibilityLabel,
  errorMessage,
  isCancelDisabled = false,
  isPending,
  message,
  onCancel,
  onConfirm,
  pendingLabel,
  testID,
  title,
  visible,
}: ConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet } = useDeviceLayout();
  const titleRef = useRef<View>(null);
  const { buttonClassName, minHeight } = getModalSize(isTablet, isLandscape);

  useEffect(() => {
    if (errorMessage) {
      AccessibilityInfo.announceForAccessibility(errorMessage);
    }
  }, [errorMessage]);

  const focusDialog = () => {
    const titleHandle = findNodeHandle(titleRef.current);

    AccessibilityInfo.announceForAccessibility(announcement);

    if (titleHandle) {
      AccessibilityInfo.setAccessibilityFocus(titleHandle);
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        // Back works like Cancel, so it's blocked whenever Cancel is.
        if (!(isPending || isCancelDisabled)) {
          onCancel();
        }
      }}
      onShow={focusDialog}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      testID={`${testID}-confirmation-native-modal`}
      transparent
      visible={visible}
    >
      <ScrollView
        accessibilityViewIsModal
        className="flex-1 bg-black/90"
        contentContainerClassName="flex-grow items-center justify-center px-4"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16),
          paddingTop: Math.max(insets.top, 16),
        }}
        testID={`${testID}-confirmation-modal`}
      >
        <View
          className="w-full items-center justify-center rounded-lg bg-medium-slate-blue/70"
          style={{
            minHeight,
            maxWidth: isTablet ? 646 : 343,
            paddingHorizontal: isTablet ? 84 : 26,
          }}
          testID={`${testID}-confirmation-dialog`}
        >
          <View accessible accessibilityRole="header" ref={titleRef}>
            <Text
              className={[
                "text-center text-white",
                isTablet ? "text-[20px]" : "text-[16px]",
              ].join(" ")}
              weight="bold"
            >
              {title}
            </Text>
          </View>
          {message ? (
            <Text
              className={[
                "text-center text-white",
                isTablet ? "mt-6 text-[18px]" : "mt-4 text-[14px]",
              ].join(" ")}
            >
              {message}
            </Text>
          ) : null}
          {errorMessage ? (
            <Text
              accessibilityLiveRegion="assertive"
              className="mt-4 text-center text-[14px] text-red-20"
              testID={`${testID}-error`}
            >
              {errorMessage}
            </Text>
          ) : null}
          <View
            className={["flex-row gap-2", isTablet ? "mt-6" : "mt-4"].join(" ")}
          >
            <Button
              accessibilityLabel={confirmAccessibilityLabel}
              accessibilityState={{ busy: isPending, disabled: isPending }}
              className={buttonClassName}
              disabled={isPending}
              labelClassName={[
                "font-euclid-bold text-dark-slate-blue",
                isTablet ? "text-[16px]" : "text-[14px]",
              ].join(" ")}
              onPress={onConfirm}
              testID={`${testID}-confirm`}
              variant="primary"
            >
              {isPending && pendingLabel ? pendingLabel : "Yes"}
            </Button>
            <Button
              accessibilityLabel={cancelAccessibilityLabel}
              accessibilityState={{ disabled: isPending || isCancelDisabled }}
              className={buttonClassName}
              disabled={isPending || isCancelDisabled}
              labelClassName={[
                "font-euclid-bold text-white",
                isTablet ? "text-[16px]" : "text-[14px]",
              ].join(" ")}
              onPress={onCancel}
              testID={`${testID}-cancel`}
              variant="transparent"
            >
              Cancel
            </Button>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}
