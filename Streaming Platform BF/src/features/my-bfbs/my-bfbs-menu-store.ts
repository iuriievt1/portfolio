import { createStore, useStore } from "zustand";

type MyBfbsMenuState = {
  isOpen: boolean;
};

// Phone My BFBS menu overlay, so a page's Back can reopen it. */
const myBfbsMenuStore = createStore<MyBfbsMenuState>(() => ({
  isOpen: false,
}));

// Opens or closes the phone My BFBS menu overlay.
export function setMyBfbsMenuOpen(isOpen: boolean) {
  myBfbsMenuStore.setState({ isOpen });
}

// Whether the phone My BFBS menu overlay is open.
export function useIsMyBfbsMenuOpen() {
  return useStore(myBfbsMenuStore, (state) => state.isOpen);
}
