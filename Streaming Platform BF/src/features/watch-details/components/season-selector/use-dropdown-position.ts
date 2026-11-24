import { useRef, useState } from "react";
import {
  Platform,
  StatusBar,
  useWindowDimensions,
  type View,
} from "react-native";

type DropdownPosition = { left: number; top: number; windowWidth: number };

/** Measures the anchor and returns where its dropdown list opens. */
export function useDropdownPosition({ gap }: { gap: number }) {
  const anchorRef = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  // A rotation moves the anchor, so the list stays closed until opened again.
  const isOpen = position?.windowWidth === windowWidth;

  // Forgets the old spot, so rotating back doesn't reopen the list.
  if (position && !isOpen) {
    setPosition(null);
  }

  const open = () => {
    // Android measures from under the status bar, but the modal starts above it.
    const statusBarOffset =
      Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

    anchorRef.current?.measureInWindow((x, y, _width, height) => {
      setPosition({
        left: x,
        top: y + height + gap + statusBarOffset,
        windowWidth,
      });
    });
  };

  const close = () => {
    setPosition(null);
  };

  return { anchorRef, close, isOpen, open, position: isOpen ? position : null };
}
