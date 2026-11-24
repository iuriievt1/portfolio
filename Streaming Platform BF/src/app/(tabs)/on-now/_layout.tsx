import { Stack } from "expo-router";
import { TAB_STACK_SCREEN_OPTIONS } from "@/utils/navigation";

export default function OnNowStackLayout() {
  return <Stack screenOptions={TAB_STACK_SCREEN_OPTIONS} />;
}
