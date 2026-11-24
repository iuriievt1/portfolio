import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  getMenuItem,
  MyBfbsPageScreen,
  setMyBfbsMenuOpen,
} from "@/features/my-bfbs";

export default function MyBfbsPageRoute() {
  const router = useRouter();
  const { page } = useLocalSearchParams<{ page: string }>();
  const item = getMenuItem(page);

  // Close the menu only once this page is showing, so the old tab never flashes.
  useFocusEffect(
    useCallback(() => {
      setMyBfbsMenuOpen(false);
    }, []),
  );

  if (!item) {
    return null;
  }

  return (
    <MyBfbsPageScreen
      item={item}
      // Pops every page off the stack, back to the menu.
      onBack={() => router.dismissTo("/my-bfbs")}
    />
  );
}
