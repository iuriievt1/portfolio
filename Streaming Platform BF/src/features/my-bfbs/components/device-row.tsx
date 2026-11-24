import type { RegisteredDevice } from "@bfbs/common-sdk";
import { type AccessibilityActionInfo, View } from "react-native";
import BinIcon from "@/assets/icons/bin-icon.svg";
import DesktopIcon from "@/assets/icons/desktop-icon.svg";
import EditIcon from "@/assets/icons/edit-icon.svg";
import PhoneIcon from "@/assets/icons/phone-icon.svg";
import TvIcon from "@/assets/icons/tv-icon.svg";
import { Button, Text } from "@/components";
import { isBrowserDevice, isMobileDevice } from "@/features/devices";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { theme } from "@/theme/theme";
import { formatDate, parseDateMs } from "@/utils/date-time";
import { useListingTimeZone } from "../time-zone-preference-store";
import { SwipeRow } from "./swipe-row";

const ICON_SIZE_PHONE = 20;
const ICON_SIZE_TABLET = 30;

type DeviceRowProps = {
  device: RegisteredDevice;
  isCurrent?: boolean;
  onRemove?: (() => void) | undefined;
  onRename?: (() => void) | undefined;
};

// Phones and tablets show a phone, browsers a desktop, and TVs a TV.
function getDeviceIcon(device: RegisteredDevice) {
  if (isMobileDevice(device)) {
    return PhoneIcon;
  }
  if (isBrowserDevice(device)) {
    return DesktopIcon;
  }
  return TvIcon;
}

export function DeviceRow({
  device,
  isCurrent = false,
  onRemove,
  onRename,
}: DeviceRowProps) {
  const { isTablet } = useDeviceLayout();
  const timeZone = useListingTimeZone();

  const displayName = device.settings?.displayName || "Unknown Device";
  const deviceType = device.displayDeviceType || "Unknown Device Type";

  const registeredMs = parseDateMs(device.registeredDateTime);
  const registered =
    registeredMs === null
      ? null
      : formatDate({ timeMs: registeredMs, timeZone });

  const Icon = getDeviceIcon(device);
  const iconSize = isTablet ? ICON_SIZE_TABLET : ICON_SIZE_PHONE;
  // Card: 4px border + 8px padding = 12px. Rows: 12px above and below only.
  const rowClassName = isCurrent
    ? "rounded-[8px] border-4 border-transparent-white-10 bg-medium-slate-blue p-2"
    : "py-3";

  const accessibilityLabel = [
    displayName,
    deviceType,
    isCurrent ? "Current Device" : null,
    registered ? `First registered ${registered}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  // Screen readers can't swipe, so the row also offers its buttons as actions.
  const accessibilityActions: AccessibilityActionInfo[] = [];
  if (onRename) {
    accessibilityActions.push({ label: "Rename", name: "rename" });
  }
  if (onRemove) {
    accessibilityActions.push({ label: "Remove", name: "remove" });
  }

  const row = (
    <View
      accessibilityActions={accessibilityActions}
      accessibilityLabel={accessibilityLabel}
      accessible
      className={`flex-row items-center gap-5 ${rowClassName}`}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "rename") {
          onRename?.();
        }
        if (event.nativeEvent.actionName === "remove") {
          onRemove?.();
        }
      }}
      testID="device-row"
    >
      <Icon color={theme.colors.white} height={iconSize} width={iconSize} />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={`shrink ${isTablet ? "text-[16px]" : "text-[14px]"} text-white`}
            numberOfLines={1}
            weight="bold"
          >
            {displayName}
          </Text>
          <View className="h-3 w-[2px] rounded-full bg-transparent-white-20" />
          <Text
            className={`shrink ${isTablet ? "text-[16px]" : "text-[14px]"} text-white`}
            numberOfLines={1}
            weight="bold"
          >
            {deviceType}
          </Text>
          {isCurrent ? (
            <View className="rounded-sm bg-black px-1.5 py-0.5">
              <Text
                className={`${isTablet ? "text-[14px]" : "text-[8px]"} text-grey-20`}
              >
                Current Device
              </Text>
            </View>
          ) : null}
        </View>
        {registered ? (
          <Text
            className={`${isTablet ? "text-[14px]" : "text-[12px]"} text-grey-30`}
            numberOfLines={1}
            weight="medium"
          >
            First Registered: {registered}
          </Text>
        ) : null}
      </View>
    </View>
  );

  // Only current device can be renamed: the SDK can't rename other devices.
  const editButton = isCurrent ? (
    <Button
      accessibilityLabel="Rename device"
      className="p-3"
      onPress={onRename}
      testID="rename-device-button"
      variant="icon"
    >
      <EditIcon color={theme.colors.white} height={iconSize} width={iconSize} />
    </Button>
  ) : null;

  // The name tells screen-reader users which device each bin removes.
  const removeButton = onRemove ? (
    <Button
      accessibilityLabel={`Remove ${displayName}`}
      className="p-3"
      onPress={onRemove}
      testID="remove-device-button"
      variant="icon"
    >
      <BinIcon color={theme.colors.white} height={iconSize} width={iconSize} />
    </Button>
  ) : null;

  // The current device has edit and bin side by side. Other devices only have the bin.
  const actions =
    editButton || removeButton ? (
      <View className="flex-row items-center">
        {editButton}
        {removeButton}
      </View>
    ) : null;

  // Tablet shows the buttons beside the row, with no swipe.
  if (isTablet || !isCurrent) {
    return actions ? (
      <View className="flex-row items-center gap-2">
        <View className="flex-1">{row}</View>
        {actions}
      </View>
    ) : (
      row
    );
  }

  return <SwipeRow actions={actions}>{row}</SwipeRow>;
}
