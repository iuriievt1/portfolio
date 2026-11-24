import {
  isDeviceNotRegisteredError,
  PlayerErrorCode,
  type PlaySessionData,
} from "@bfbs/common-sdk";
import {
  CancelledError,
  isCancelledError,
  type QueryClient,
} from "@tanstack/react-query";
import { isSessionExpiredError } from "@/features/auth/utils/session-expiry";
import { reportError } from "@/infra/error";
import {
  isMockLiveChannel,
  shouldUseLivePlayerMocks,
} from "./mocks/live-player-mocks";
import {
  fairplayCertificateQueryOptions,
  playSessionQueryOptions,
  vodAssetQueryOptions,
} from "./playback-queries";
import { isUnsupportedSourceForPlatform } from "./utils/create-load-request";
import {
  isFairplaySession,
  isUnsupportedDrmForPlatform,
} from "./utils/drm-type";
import { mapPlaybackErrorToCode } from "./utils/playback-error-code";
import { reportPlaybackError } from "./utils/report-playback-error";
import { resolvePlaybackMedia } from "./utils/resolve-playback-media";

export type PlaybackTarget =
  | { channelId: string; kind: "live" }
  | { assetId: string; kind: "vod" };

function usesMockedLivePlayback(target: PlaybackTarget) {
  return (
    target.kind === "live" &&
    (shouldUseLivePlayerMocks() || isMockLiveChannel(target.channelId))
  );
}

async function getFairplayCertificateUrl(
  queryClient: QueryClient,
  playSession: PlaySessionData,
) {
  if (!isFairplaySession(playSession)) {
    return undefined;
  }

  return queryClient.ensureQueryData(fairplayCertificateQueryOptions());
}

/** Closes a session the player will never open. */
function releasePlaySession(
  queryClient: QueryClient,
  playSession: PlaySessionData,
) {
  queryClient.removeQueries({
    queryKey: ["playSession"],
    predicate: (query) => query.state.data === playSession,
  });
  void playSession.close().catch((error: unknown) => reportError(error));
}

/** Authorizes and prepares playback, releasing abandoned sessions before a player takes ownership. */
export async function preparePlayback(
  queryClient: QueryClient,
  target: PlaybackTarget,
  authorizePlayback: () => Promise<boolean>,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) {
    throw new CancelledError();
  }
  if (usesMockedLivePlayback(target)) {
    if (!(await authorizePlayback())) {
      throw new CancelledError();
    }
    return null;
  }

  let playSession: PlaySessionData | undefined;
  const sessionInput =
    target.kind === "vod"
      ? { assetId: target.assetId }
      : { channelId: target.channelId };
  const cancelPreparation = () => {
    void queryClient.cancelQueries({
      queryKey: ["playSession", sessionInput],
      exact: true,
    });
    if (playSession) {
      releasePlaySession(queryClient, playSession);
      playSession = undefined;
    }
  };
  signal?.addEventListener("abort", cancelPreparation);

  try {
    if (target.kind === "vod") {
      await queryClient.fetchQuery(vodAssetQueryOptions(target.assetId));
    }

    if (signal?.aborted) {
      throw new CancelledError();
    }
    playSession = await queryClient.fetchQuery(
      playSessionQueryOptions(sessionInput, authorizePlayback),
    );
    if (signal?.aborted) {
      cancelPreparation();
      throw new CancelledError();
    }

    if (isUnsupportedDrmForPlatform(playSession)) {
      releasePlaySession(queryClient, playSession);
      return PlayerErrorCode.DEVICE_NOT_SUPPORTED;
    }

    const certificateUrl = await getFairplayCertificateUrl(
      queryClient,
      playSession,
    );
    if (signal?.aborted) {
      throw new CancelledError();
    }
    const { sourceType } = resolvePlaybackMedia(playSession, certificateUrl);

    if (isUnsupportedSourceForPlatform(sourceType)) {
      releasePlaySession(queryClient, playSession);
      return PlayerErrorCode.FORMAT_NOT_SUPPORTED;
    }

    return null;
  } catch (error) {
    if (signal?.aborted) {
      throw new CancelledError();
    }
    if (
      isCancelledError(error) ||
      isSessionExpiredError(error) ||
      isDeviceNotRegisteredError(error)
    ) {
      throw error;
    }

    // e.g fetch failed after GO opened a session.
    if (playSession) {
      releasePlaySession(queryClient, playSession);
    }

    reportPlaybackError(error, { playSessionError: error });

    return mapPlaybackErrorToCode({ playSessionError: error });
  } finally {
    signal?.removeEventListener("abort", cancelPreparation);
  }
}
