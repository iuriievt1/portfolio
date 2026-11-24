import { Stack } from "expo-router";
import { TAB_STACK_SCREEN_OPTIONS } from "@/utils/navigation";

/** Keeps Search selected while users browse result details. */
export default function SearchStackLayout() {
  return <Stack screenOptions={TAB_STACK_SCREEN_OPTIONS} />;
}
