import { Stack } from "expo-router";
import { TAB_STACK_SCREEN_OPTIONS } from "@/utils/navigation";

export default function HomeStackLayout() {
  return <Stack screenOptions={TAB_STACK_SCREEN_OPTIONS} />;
}
