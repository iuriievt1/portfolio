import type { ContentItem, PlaySessionData } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { handleDeviceRemoval } from "@/features/auth/utils/device-removal";
import { getContentDurationSeconds } from "@/features/content-rails/content";
import type { VodAsset, VodVideoSource } from "@/features/video-player/types";
import { pickProgrammeImageUrl } from "@/utils/media";
import { vodAssetQueryOptions } from "../../playback-queries";
import { isFairplaySession } from "../../utils/drm-type";
import { reportPlaybackError } from "../../utils/report-playback-error";
import { resolvePlaybackMedia } from "../../utils/resolve-playback-media";
import { useFairplayCertificateUrl } from "../use-fairplay-certificate-url";
import { usePlaySession } from "../use-play-session";

type UseVodPlayerSourceResult = {
  error: unknown | null;
  isLoading: boolean;
  retry: () => void;
  source: VodVideoSource | null;
};

type VodSourceResolutionResult = {
  error: unknown | null;
  reportableError: unknown;
  source: VodVideoSource | null;
};

function createSourceFromAsset({
  asset,
  contentItem,
  fairplayCertificateUrl,
  playSession,
}: {
  asset: VodAsset;
  contentItem: ContentItem;
  fairplayCertificateUrl: string | undefined;
  playSession: PlaySessionData;
}): VodVideoSource {
  const { drm, sourceType, url } = resolvePlaybackMedia(
    playSession,
    fairplayCertificateUrl,
  );
  const durationSeconds =
    getContentDurationSeconds(contentItem) ?? asset.durationSeconds;
  const posterUrl = pickProgrammeImageUrl(contentItem.media);
  const startPositionSeconds =
    contentItem.lastPlayPositionSeconds ?? playSession.startPlayPositionSeconds;

  return {
    playSession,
    sourceType,
    title: contentItem.title || asset.title,
    url,
    ...(drm ? { drm } : {}),
    ...(contentItem.contentAdvisories
      ? { contentAdvisories: contentItem.contentAdvisories }
      : {}),
    ...(durationSeconds == null ? {} : { durationSeconds }),
    ...(contentItem.episodeNumber
      ? { episodeNumber: contentItem.episodeNumber }
      : {}),
    ...(contentItem.episodeTitle
      ? { episodeTitle: contentItem.episodeTitle }
      : {}),
    ...(contentItem.parentalRating
      ? { parentalRating: contentItem.parentalRating }
      : {}),
    ...(posterUrl ? { posterUrl } : {}),
    ...(contentItem.seasonNumber
      ? { seasonNumber: contentItem.seasonNumber }
      : {}),
    ...(startPositionSeconds == null ? {} : { startPositionSeconds }),
  };
}

/** Resolves a VOD asset into the SDK PlaySession-backed source loaded by Bitmovin. */
export function useVodPlayerSource(
  asset: VodAsset | null,
): UseVodPlayerSourceResult {
  const assetId = asset?.id;
  const assetQuery = useQuery(vodAssetQueryOptions(assetId));
  const playSessionQuery = usePlaySession(assetId ? { assetId } : null);
  const isFairplay = isFairplaySession(playSessionQuery.data);
  const fairplayCertificateQuery = useFairplayCertificateUrl(isFairplay);
  const fairplayCertificateUrl = fairplayCertificateQuery.data ?? undefined;

  const resolvedSource = useMemo<VodSourceResolutionResult>(() => {
    if (!(asset && assetQuery.data && playSessionQuery.data)) {
      return { error: null, reportableError: null, source: null };
    }

    try {
      return {
        error: null,
        reportableError: null,
        source: createSourceFromAsset({
          asset,
          contentItem: assetQuery.data,
          fairplayCertificateUrl,
          playSession: playSessionQuery.data,
        }),
      };
    } catch (error) {
      return {
        error,
        reportableError: error,
        source: null,
      };
    }
  }, [asset, assetQuery.data, fairplayCertificateUrl, playSessionQuery.data]);

  useEffect(() => {
    if (assetQuery.error) {
      reportPlaybackError(assetQuery.error, {
        playSessionError: assetQuery.error,
      });
    }
  }, [assetQuery.error]);

  useEffect(() => {
    if (playSessionQuery.error) {
      reportPlaybackError(playSessionQuery.error, {
        playSessionError: playSessionQuery.error,
      });
    }
  }, [playSessionQuery.error]);

  useEffect(() => {
    if (resolvedSource.reportableError) {
      reportPlaybackError(resolvedSource.reportableError, {
        playSessionError: resolvedSource.reportableError,
      });
    }
  }, [resolvedSource.reportableError]);

  if (!asset) {
    return {
      error: null,
      isLoading: false,
      retry: () => {},
      source: null,
    };
  }

  return {
    error: assetQuery.error ?? playSessionQuery.error ?? resolvedSource.error,
    isLoading:
      assetQuery.isLoading ||
      playSessionQuery.isLoading ||
      (isFairplay && fairplayCertificateQuery.isLoading),
    // The user pressed retry, so a removal here shows AUTH_020.
    retry: () => {
      void assetQuery.refetch().then(({ error }) => handleDeviceRemoval(error));
      void playSessionQuery
        .refetch()
        .then(({ error }) => handleDeviceRemoval(error));
    },
    source: resolvedSource.source,
  };
}
