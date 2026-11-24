import { Stack } from "expo-router";
import { TAB_STACK_SCREEN_OPTIONS } from "@/utils/navigation";

export default function SectionStackLayout() {
  return <Stack screenOptions={TAB_STACK_SCREEN_OPTIONS} />;
}
