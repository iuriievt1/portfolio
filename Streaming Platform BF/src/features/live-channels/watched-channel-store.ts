import { createStore, useStore } from "zustand";

type WatchedChannelState = {
  channelId: string | null;
};

/** The live channel the user is watching, shared by the player and the full guide. */
const watchedChannelStore = createStore<WatchedChannelState>(() => ({
  channelId: null,
}));

/** Saves the live channel the user is now watching. */
export function setWatchedChannelId(channelId: string) {
  watchedChannelStore.setState({ channelId });
}

/** The live channel the user watched last. */
export function useWatchedChannelId() {
  return useStore(watchedChannelStore).channelId;
}
