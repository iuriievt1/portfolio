import { Portal } from "@gorhom/portal";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, View } from "react-native";
import { Button, Text, TextField } from "@/components";
import { useRenameDevice } from "@/features/devices";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { theme } from "@/theme/theme";

type RenameDeviceModalProps = {
  currentName: string;
  onClose: () => void;
};

function getModalSize(isTablet: boolean, isLandscape: boolean) {
  if (!isTablet) {
    return { buttonWidth: 123, width: 343 };
  }

  return isLandscape
    ? { buttonWidth: 263, width: 677 }
    : { buttonWidth: 174, width: 646 };
}

export function RenameDeviceModal({
  currentName,
  onClose,
}: RenameDeviceModalProps) {
  const { isLandscape, isTablet } = useDeviceLayout();
  const [name, setName] = useState(currentName);
  const rename = useRenameDevice();
  const isSavingRef = useRef(false);
  const isEmpty = name.trim() === "";
  const canSave = !(isEmpty || rename.isPending);
  const { buttonWidth, width } = getModalSize(isTablet, isLandscape);
  const textSize = isTablet ? "text-[18px]" : "text-[14px]";
  const labelSize = isTablet ? "text-[16px]" : "text-[14px]";

  const changeName = (text: string) => {
    setName(text);

    if (rename.isError) {
      rename.reset();
    }
  };

  const save = () => {
    if (!canSave || isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    rename.mutate(name, {
      onSettled: () => {
        isSavingRef.current = false;
      },
      onSuccess: onClose,
    });
  };

  const close = () => {
    if (!rename.isPending) {
      onClose();
    }
  };

  // Drawn at the app root, outside the page's ScrollView, so a tap on Save works
  // the first time even while the keyboard is open.
  return (
    <Portal>
      <Modal
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible
      >
        <View className="flex-1 items-center justify-center bg-black/80 px-4">
          <KeyboardAvoidingView
            behavior="position"
            className="w-full"
            keyboardVerticalOffset={16}
            style={{ maxWidth: width }}
          >
            <View
              accessibilityViewIsModal
              className={`w-full bg-medium-slate-blue px-5 ${isTablet ? "gap-4 pb-11 pt-[60px]" : "gap-5 pb-4 pt-[30px]"}`}
              testID="rename-device-modal"
            >
              <Text className={`${textSize} text-oatmeal`}>
                You can rename your current Logged in device. This name will
                only be visible within BFBS Devices
              </Text>
              <View className="gap-3">
                <TextField
                  accessibilityLabel="Device name"
                  autoFocus
                  className={`rounded-lg border-white bg-black/40 ${isTablet ? "border-4" : "border-2"}`}
                  maxLength={15}
                  onChangeText={changeName}
                  style={{
                    color: theme.colors.oatmeal,
                    fontSize: isTablet ? 18 : 14,
                  }}
                  surface="bare"
                  testID="rename-device-input"
                  value={name}
                />
                {rename.isError ? (
                  <Text
                    accessibilityLiveRegion="assertive"
                    accessibilityRole="alert"
                    className="text-[14px] text-red-20"
                    testID="rename-device-error"
                  >
                    We couldn't rename your device. Please try again.
                  </Text>
                ) : null}
                <View className="flex-row justify-center gap-5">
                  <Button
                    accessibilityState={{ disabled: !canSave }}
                    className={`h-[45px] ${canSave ? "" : "opacity-50"}`}
                    disabled={!canSave}
                    labelClassName={`font-euclid-bold text-dark-slate-blue ${labelSize}`}
                    onPress={save}
                    style={{ width: buttonWidth }}
                    testID="rename-device-save"
                    variant="primary"
                  >
                    Save
                  </Button>
                  <Button
                    className="h-[45px]"
                    disabled={rename.isPending}
                    labelClassName={`font-euclid-bold text-oatmeal ${labelSize}`}
                    onPress={close}
                    style={{ width: buttonWidth }}
                    testID="rename-device-cancel"
                    variant="transparent"
                  >
                    Cancel
                  </Button>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Portal>
  );
}
