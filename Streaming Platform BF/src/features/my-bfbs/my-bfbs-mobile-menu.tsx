import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import CloseIcon from "@/assets/icons/close-icon.svg";
import { Button, Text } from "@/components";
import { useIsTooManyDevices } from "@/features/auth/auth-session-context";
import { theme } from "@/theme/theme";
import { LogoutAction } from "./logout-action";
import { getPageName, MENU_ITEMS } from "./menu-items";

type MyBfbsMobileMenuProps = {
  onClose: () => void;
  onOpenDevices?: (() => void) | undefined;
};

export function MyBfbsMobileMenu({
  onClose,
  onOpenDevices,
}: MyBfbsMobileMenuProps) {
  const router = useRouter();
  const isTooManyDevices = useIsTooManyDevices();

  return (
    <View className="flex-1 bg-dark-slate-blue/95">
      <ScrollView contentContainerClassName="gap-4 px-4 pb-6">
        <Text
          className="mb-[17px] mt-[112px] text-center text-[20px] text-oatmeal"
          weight="semibold"
        >
          Welcome to my BFBS hub
        </Text>
        {MENU_ITEMS.map((item) => {
          // AUTH_021: only Devices works until a device is removed.
          const isDisabled = isTooManyDevices && item !== "Devices";

          return (
            <Button
              className={isDisabled ? "opacity-50" : ""}
              disabled={isDisabled}
              key={item}
              labelClassName="font-euclid-bold text-[16px] text-white"
              onPress={() => {
                if (isTooManyDevices) {
                  onOpenDevices?.();
                  return;
                }

                router.navigate(
                  {
                    params: { page: getPageName(item) },
                    pathname: "/my-bfbs/[page]",
                  },
                  { withAnchor: true },
                );
              }}
              variant="transparent"
            >
              {item}
            </Button>
          );
        })}
        <LogoutAction variant="mobile" />
      </ScrollView>
      <Button
        accessibilityLabel="Close"
        className="absolute right-[26px] top-[63px]"
        hitSlop={12}
        onPress={onClose}
        testID="my-bfbs-close"
        variant="icon"
      >
        <CloseIcon color={theme.colors.white} height={20} width={20} />
      </Button>
    </View>
  );
}
