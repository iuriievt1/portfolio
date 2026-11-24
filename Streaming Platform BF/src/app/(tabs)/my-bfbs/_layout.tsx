import { Stack } from "expo-router";
import { TAB_STACK_SCREEN_OPTIONS } from "@/utils/navigation";

// The menu (index) sits under every page, so Back always has it to return to.
export const unstable_settings = { anchor: "index" };

export default function MyBfbsStackLayout() {
  return <Stack screenOptions={TAB_STACK_SCREEN_OPTIONS} />;
}
