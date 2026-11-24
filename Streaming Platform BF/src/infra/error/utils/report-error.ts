import * as Sentry from "@sentry/react-native";

export type ReportErrorContext = {
  /** Tags forwarded to the error tracking backend for triage and filtering. */
  tags?: Record<string, string>;
};

/** Reports an error to Sentry (and the JS console in dev builds). */
export function reportError(
  error: unknown,
  context?: ReportErrorContext,
): void {
  if (__DEV__) {
    console.error("[reportError]", error, context);
  }
  Sentry.captureException(error, context);
}
