import { reportError } from "@/infra/error";
import type { PlaybackErrorContext } from "./playback-error-code";
import { mapPlaybackErrorToCode } from "./playback-error-code";

/** Sentry gets the code the user sees. */
export function reportPlaybackError(
  error: unknown,
  context: PlaybackErrorContext,
) {
  reportError(error, { tags: { errorCode: mapPlaybackErrorToCode(context) } });
}
