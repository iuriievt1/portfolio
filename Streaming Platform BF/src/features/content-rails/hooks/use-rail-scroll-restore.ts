import { useFocusEffect } from "expo-router";
import { useRef } from "react";
import type {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useScrollRestore } from "@/features/content-rails/hooks/use-scroll-restore";
import type { PageRail } from "@/features/content-rails/types";

/** Restores the rails position. */
export function useRailScrollRestore() {
  const listRef = useRef<FlatList<PageRail>>(null);
  const scrollOffsetRef = useRef(0);
  const cameFromViewAllRef = useRef(false);
  const { cancel, coverOpacity, isRestoring, start } = useScrollRestore();

  useFocusEffect(() => {
    const cameFromViewAll = cameFromViewAllRef.current;
    cameFromViewAllRef.current = false;

    if (!cameFromViewAll) {
      return;
    }

    return start(() => {
      if (scrollOffsetRef.current > 0) {
        listRef.current?.scrollToOffset({
          animated: false,
          offset: scrollOffsetRef.current,
        });
      }
    });
  });

  const markReturningFromViewAll = () => {
    cameFromViewAllRef.current = true;
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isRestoring()) {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    }
  };

  return {
    coverOpacity,
    handleScroll,
    handleScrollBeginDrag: cancel,
    listRef,
    markReturningFromViewAll,
  };
}
