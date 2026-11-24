import {
  ClientMetadata,
  ContentCatalogue,
  type CreatePlaySessionInput,
  PlaySession,
  type PlaySessionData,
} from "@bfbs/common-sdk";
import { CancelledError, queryOptions, skipToken } from "@tanstack/react-query";
import { reportError } from "@/infra/error";

const PLAYBACK_STALE_TIME_MS = 0;

/** Outlives the push into the player. */
const PLAYBACK_GC_TIME_MS = 60_000;

/** Checks signed-in device integrity before opening any live or VOD session. */
export function playSessionQueryOptions(
  input: CreatePlaySessionInput | null,
  authorizePlayback: () => Promise<boolean>,
) {
  return queryOptions<PlaySessionData>({
    gcTime: PLAYBACK_GC_TIME_MS,
    queryFn: input
      ? async ({ client, queryKey, signal }) => {
          if (!(await authorizePlayback()) || signal.aborted) {
            if (!signal.aborted) {
              // Revert query state without resolving a denied launch with cached data.
              void client.cancelQueries(
                { queryKey, exact: true },
                { silent: true },
              );
            }
            throw new CancelledError();
          }
          const session = await PlaySession.createPlaySession(input);
          if (signal.aborted) {
            // A foreground failure or sign-out can cancel while GO opens the session.
            void session.close().catch((error: unknown) => reportError(error));
            throw new CancelledError();
          }
          return session;
        }
      : skipToken,
    queryKey: ["playSession", input],
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: PLAYBACK_STALE_TIME_MS,
  });
}

export function vodAssetQueryOptions(assetId: string | undefined) {
  return queryOptions({
    gcTime: PLAYBACK_GC_TIME_MS,
    queryFn: assetId
      ? () => ContentCatalogue.getAsset({ assetId, shared: false })
      : skipToken,
    queryKey: ["vodPlayerAsset", assetId],
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: PLAYBACK_STALE_TIME_MS,
  });
}

export function fairplayCertificateQueryOptions() {
  return queryOptions({
    queryFn: () => ClientMetadata.getFairplayServerCertificateUrl(),
    queryKey: ["fairplayServerCertificateUrl"],
    staleTime: Number.POSITIVE_INFINITY,
  });
}
