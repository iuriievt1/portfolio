import { Text } from "@/components";
import { useDeviceLayout } from "@/hooks/use-device-layout";

// Page heading on phone. Tablet shows none: the selected menu item names the page.
export function PageTitle({ children }: { children: string }) {
  const { isTablet } = useDeviceLayout();

  if (isTablet) {
    return null;
  }

  return (
    <Text
      accessibilityRole="header"
      className="text-[18px] text-oatmeal"
      weight="semibold"
    >
      {children}
    </Text>
  );
}
