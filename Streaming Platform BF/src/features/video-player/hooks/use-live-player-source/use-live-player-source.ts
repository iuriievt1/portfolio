import type { ContentItem, PlaySessionData } from "@bfbs/common-sdk";
import { useEffect, useMemo } from "react";
import { handleDeviceRemoval } from "@/features/auth/utils/device-removal";
import type { LiveChannel } from "@/features/live-channels";
import { getProgrammeEndDateTime } from "@/utils/programme";
import {
  createMockLiveVideoSource,
  isMockLiveChannel,
  shouldUseLivePlayerMocks,
} from "../../mocks/live-player-mocks";
import type { LiveProgramme, VideoSource } from "../../types";
import { isFairplaySession } from "../../utils/drm-type";
import { mapPlaybackErrorToCode } from "../../utils/playback-error-code";
import { reportPlaybackError } from "../../utils/report-playback-error";
import { resolvePlaybackMedia } from "../../utils/resolve-playback-media";
import { useFairplayCertificateUrl } from "../use-fairplay-certificate-url";
import { usePlaySession } from "../use-play-session";

type LivePlayerSourceState = {
  errorCode: string | null;
  isLoading: boolean;
  retry: () => void;
  source: VideoSource | null;
};

type SourceResolutionResult = {
  reportableError: unknown;
  source: VideoSource | null;
};

function toLiveErrorCode(error: unknown): string {
  return mapPlaybackErrorToCode({ playSessionError: error });
}

function mapProgramme(
  programme: ContentItem | undefined,
): LiveProgramme | null {
  if (!programme?.startDateTime) {
    return null;
  }

  const endsAt = getProgrammeEndDateTime(programme);

  if (!endsAt) {
    return null;
  }

  return {
    endsAt,
    id: programme.id,
    startsAt: programme.startDateTime,
    title: programme.title,
  };
}

function getSourceMetadata(channel: LiveChannel) {
  const programme = mapProgramme(channel.currentProgramme);
  const title = programme?.title ?? channel.name;

  return { programme, title };
}

function createSourceFromChannel({
  channel,
  fairplayCertificateUrl,
  playSession,
}: {
  channel: LiveChannel;
  fairplayCertificateUrl: string | undefined;
  playSession: PlaySessionData;
}): VideoSource {
  const { programme, title } = getSourceMetadata(channel);
  const { drm, sourceType, url } = resolvePlaybackMedia(
    playSession,
    fairplayCertificateUrl,
  );

  return {
    channelId: channel.id,
    channelTitle: channel.name,
    playSession,
    sourceType,
    title,
    url,
    ...(drm ? { drm } : {}),
    ...(programme ? { programme } : {}),
  };
}

function createMockSourceFromChannel(channel: LiveChannel) {
  const { programme, title } = getSourceMetadata(channel);

  return createMockLiveVideoSource(channel, {
    programme,
    title,
  });
}

function resolveSource({
  channel,
  fairplayCertificateUrl,
  playSession,
}: {
  channel: LiveChannel;
  fairplayCertificateUrl: string | undefined;
  playSession: PlaySessionData;
}): SourceResolutionResult {
  try {
    return {
      reportableError: null,
      source: createSourceFromChannel({
        channel,
        fairplayCertificateUrl,
        playSession,
      }),
    };
  } catch (error) {
    return {
      reportableError: error,
      source: null,
    };
  }
}

/**
 * Loads the selected live channel source and keeps programme metadata in sync with schedule updates.
 */
export function useLivePlayerSource(channel: LiveChannel | null) {
  const shouldUseMocks =
    channel !== null &&
    (shouldUseLivePlayerMocks() || isMockLiveChannel(channel.id));
  const playSessionQuery = usePlaySession(
    !channel || shouldUseMocks ? null : { channelId: channel.id },
  );
  // The user pressed retry, so a removal here shows AUTH_020.
  const retry = () => {
    void playSessionQuery
      .refetch()
      .then(({ error }) => handleDeviceRemoval(error));
  };
  const isFairplay = isFairplaySession(playSessionQuery.data);
  const fairplayCertificateQuery = useFairplayCertificateUrl(isFairplay);
  const fairplayCertificateUrl = fairplayCertificateQuery.data ?? undefined;
  const resolvedSource = useMemo<SourceResolutionResult>(() => {
    if (!channel || shouldUseMocks || !playSessionQuery.data) {
      return {
        reportableError: null,
        source:
          shouldUseMocks && channel
            ? createMockSourceFromChannel(channel)
            : null,
      };
    }

    return resolveSource({
      channel,
      fairplayCertificateUrl,
      playSession: playSessionQuery.data,
    });
  }, [channel, fairplayCertificateUrl, playSessionQuery.data, shouldUseMocks]);

  useEffect(() => {
    if (!shouldUseMocks && playSessionQuery.error) {
      reportPlaybackError(playSessionQuery.error, {
        playSessionError: playSessionQuery.error,
      });
    }
  }, [playSessionQuery.error, shouldUseMocks]);

  useEffect(() => {
    if (resolvedSource.reportableError) {
      reportPlaybackError(resolvedSource.reportableError, {
        playSessionError: resolvedSource.reportableError,
      });
    }
  }, [resolvedSource.reportableError]);

  if (!channel) {
    return {
      errorCode: null,
      isLoading: false,
      retry: () => {},
      source: null,
    } satisfies LivePlayerSourceState;
  }

  if (shouldUseMocks) {
    return {
      errorCode: null,
      isLoading: false,
      retry: () => {},
      source: resolvedSource.source,
    } satisfies LivePlayerSourceState;
  }

  if (
    playSessionQuery.isLoading ||
    (isFairplay && fairplayCertificateQuery.isLoading)
  ) {
    return {
      errorCode: null,
      isLoading: true,
      retry,
      source: null,
    } satisfies LivePlayerSourceState;
  }

  if (playSessionQuery.error) {
    return {
      errorCode: toLiveErrorCode(playSessionQuery.error),
      isLoading: false,
      retry,
      source: null,
    } satisfies LivePlayerSourceState;
  }

  return {
    errorCode: resolvedSource.reportableError
      ? toLiveErrorCode(resolvedSource.reportableError)
      : null,
    isLoading: false,
    retry,
    source: resolvedSource.source,
  } satisfies LivePlayerSourceState;
}
