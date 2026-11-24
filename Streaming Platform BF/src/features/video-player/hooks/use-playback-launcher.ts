import { isCancelledError } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { usePlaybackAuthorization } from "@/features/auth/auth-session-context";
import { handleDeviceRemoval } from "@/features/auth/utils/device-removal";
import { handleSessionExpiry } from "@/features/auth/utils/session-expiry";
import { errorCodes, reportError, showErrorModal } from "@/infra/error";
import { appQueryClient } from "@/infra/query/app-query-client";
import type { PlaybackTarget } from "../prepare-playback";
import { preparePlayback } from "../prepare-playback";

type VodLaunchParams = {
  id: string;
  title?: string | undefined;
};

function getTargetKey(target: PlaybackTarget) {
  return target.kind === "live"
    ? `live:${target.channelId}`
    : `vod:${target.assetId}`;
}

/** Opens authorized playback, abandoning pending navigation when the auth gate unmounts it. */
export function usePlaybackLauncher() {
  const authorizePlayback = usePlaybackAuthorization();
  /**
   * One launcher serves every tile of a rail, so the guard holds the target
   * being prepared: pressing the same tile again is ignored, while pressing
   * another one takes over and leaves the earlier target behind.
   */
  const preparingRef = useRef<{
    key: string;
    controller: AbortController;
  } | null>(null);
  useEffect(
    () => () => {
      preparingRef.current?.controller.abort();
      preparingRef.current = null;
    },
    [],
  );

  const canPlay = async (target: PlaybackTarget, onRetry: () => void) => {
    const targetKey = getTargetKey(target);

    if (preparingRef.current?.key === targetKey) {
      return false;
    }

    preparingRef.current?.controller.abort();
    const request = { key: targetKey, controller: new AbortController() };
    preparingRef.current = request;

    try {
      const failureCode = await preparePlayback(
        appQueryClient,
        target,
        authorizePlayback,
        request.controller.signal,
      );

      if (preparingRef.current !== request) {
        return false;
      }

      if (failureCode) {
        showErrorModal(failureCode, onRetry);
        return false;
      }

      return true;
    } catch (error) {
      if (isCancelledError(error) || preparingRef.current !== request) {
        return false;
      }
      // Play was pressed, so the user is waiting; the query client skips cached refetches.
      if (handleDeviceRemoval(error)) {
        return false;
      }

      if (handleSessionExpiry(error)) {
        return false;
      }

      reportError(error, { tags: { area: "playback", operation: "prepare" } });

      if (preparingRef.current === request) {
        showErrorModal(errorCodes.unexpected, onRetry);
      }

      return false;
    } finally {
      if (preparingRef.current === request) {
        preparingRef.current = null;
      }
    }
  };

  const openLiveChannel = async (channelId: string) => {
    const retryOpen = () => {
      void openLiveChannel(channelId);
    };

    if (!(await canPlay({ channelId, kind: "live" }, retryOpen))) {
      return;
    }

    router.push({
      params: { channelId },
      pathname: "/player/live/[channelId]",
    });
  };

  const openVodAsset = async ({ id, title }: VodLaunchParams) => {
    const retryOpen = () => {
      void openVodAsset({ id, title });
    };

    if (!(await canPlay({ assetId: id, kind: "vod" }, retryOpen))) {
      return;
    }

    router.push({
      params: { id, title },
      pathname: "/player/vod/[id]",
    });
  };

  return { openLiveChannel, openVodAsset };
}
