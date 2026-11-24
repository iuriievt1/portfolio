import { useRouter } from "expo-router";
import { MyBfbsMobileMenu, MyBfbsTabletMenu } from "@/features/my-bfbs";
import { useDeviceLayout } from "@/hooks/use-device-layout";

export default function MyBfbsRoute() {
  const router = useRouter();
  const { isTablet } = useDeviceLayout();

  if (isTablet) {
    return <MyBfbsTabletMenu onBack={() => router.back()} />;
  }

  return <MyBfbsMobileMenu onClose={() => router.back()} />;
}
