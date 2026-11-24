import { useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/** Scroll offsets kept for remounts within the same app session. */
const gridScrollOffsets = new Map<string, number>();
const railScrollOffsets = new Map<string, number>();

/** Persists a rail's horizontal offset. */
export function useRailScrollMemory(railId: string) {
  /** Frozen at mount, and read without touching a ref during render. */
  const [savedOffset] = useState(() => railScrollOffsets.get(railId));

  const saveOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    railScrollOffsets.set(railId, event.nativeEvent.contentOffset.x);
  };

  return {
    hasSavedOffset: savedOffset !== undefined,
    initialOffset: savedOffset ?? 0,
    saveOffset,
  };
}

/** Drops a grid offset, so a fresh View All opens at the 16th item. */
export function clearGridScrollMemory(railId: string) {
  gridScrollOffsets.delete(railId);
}

/** Grid offset, kept for remounts. */
export function useGridScrollMemory(railId: string) {
  /** Frozen at mount, and read without touching a ref during render. */
  const [mountOffset] = useState(() => gridScrollOffsets.get(railId));

  const getSavedOffset = () => gridScrollOffsets.get(railId);

  const saveOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    gridScrollOffsets.set(railId, event.nativeEvent.contentOffset.y);
  };

  return { getSavedOffset, mountOffset, saveOffset };
}
