import { type ReactNode, useState } from "react";

import { View } from "react-native";
import { Button, Text } from "@/components";
import {
  useIsTooManyDevices,
  useRegisterDevice,
} from "@/features/auth/auth-session-context";
import { useDevices } from "@/features/devices";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { DeviceListSkeleton } from "../components/device-list-skeleton";
import { DeviceRow } from "../components/device-row";
import { PageTitle } from "../components/page-title";
import { RemoveDeviceModal } from "../components/remove-device-modal";
import { RemoveThisDeviceModal } from "../components/remove-this-device-modal";
import { RenameDeviceModal } from "../components/rename-device-modal";

export function DevicesPage() {
  const { isTablet } = useDeviceLayout();
  const isTooManyDevices = useIsTooManyDevices();
  const registerDevice = useRegisterDevice();
  const { data, isFetching, isPending, refetch } = useDevices(isTooManyDevices);
  const [isRenaming, setIsRenaming] = useState(false);
  const [deviceIdToRemove, setDeviceIdToRemove] = useState<string | null>(null);
  const [isRemovingThisDevice, setIsRemovingThisDevice] = useState(false);

  let content: ReactNode;

  // Also covers Try again, so the error doesn't sit there while it reloads.
  if (isPending || (!data && isFetching)) {
    content = <DeviceListSkeleton />;
  } else if (data) {
    content = (
      <View className="gap-4">
        {/* No current device in AUTH_021: it isn't registered yet. */}
        {data.current ? (
          <DeviceRow
            device={data.current}
            isCurrent
            onRemove={() => setIsRemovingThisDevice(true)}
            onRename={() => setIsRenaming(true)}
          />
        ) : null}
        {data.others.length > 0 ? (
          <View className="gap-6">
            <Text
              accessibilityRole="header"
              className={`${isTablet ? "text-[18px]" : "text-[16px]"} text-oatmeal`}
              numberOfLines={1}
            >
              Other registered devices
            </Text>
            <View className="gap-2">
              {data.others.map((device) => (
                <DeviceRow
                  device={device}
                  key={device.id}
                  onRemove={() => setDeviceIdToRemove(device.id)}
                />
              ))}
            </View>
          </View>
        ) : null}
        {isRenaming && data.current ? (
          <RenameDeviceModal
            currentName={data.current.settings?.displayName || "Unknown Device"}
            onClose={() => setIsRenaming(false)}
          />
        ) : null}
        {deviceIdToRemove ? (
          <RemoveDeviceModal
            deviceId={deviceIdToRemove}
            onClose={() => setDeviceIdToRemove(null)}
            onRemoved={registerDevice}
          />
        ) : null}
        {isRemovingThisDevice && data.current ? (
          <RemoveThisDeviceModal
            deviceId={data.current.id}
            onClose={() => setIsRemovingThisDevice(false)}
          />
        ) : null}
      </View>
    );
  } else {
    content = (
      <View accessibilityLiveRegion="polite" className="items-start gap-4">
        <Text
          accessibilityRole="alert"
          className="text-[16px] text-white"
          weight="semibold"
        >
          We couldn't load your devices.
        </Text>
        <Button onPress={() => void refetch()} testID="devices-retry">
          Try again
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <PageTitle>Manage Device Sessions</PageTitle>
      {content}
    </View>
  );
}
