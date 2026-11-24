import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { handleDeviceRemoval } from "@/features/auth/utils/device-removal";
import { handleSessionExpiry } from "@/features/auth/utils/session-expiry";

/**
 * Shared React Query client for app-level remote state.
 */
export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
  mutationCache: new MutationCache({
    onError: handleDeviceRemoval,
  }),
  queryCache: new QueryCache({
    onError: (error, query) => {
      // A refetch of data already on screen is background work, so removal waits
      // for the next request the user is waiting on (#220).
      const isBackgroundRefetch = query.state.data !== undefined;

      if (!isBackgroundRefetch && handleDeviceRemoval(error)) {
        return;
      }

      handleSessionExpiry(error);
    },
  }),
});
