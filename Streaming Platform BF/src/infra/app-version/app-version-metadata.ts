import Constants from "expo-constants";

export type AppVersionMetadata = {
  buildId: number | string;
  commitHash: string;
  environment: string;
  version: string;
};

const fallbackMetadata: AppVersionMetadata = {
  buildId: "local",
  commitHash: "unknown",
  environment: "local",
  version: "0.0.0",
};

/**
 * Reads the build metadata injected by `app.config.ts` into `extra.appVersion`.
 *
 * `buildId` and `commitHash` come from the GitLab job (`APP_BUILD_NUMBER` and
 * `APP_COMMIT_HASH`), falling back to the local git hash for developer builds.
 * `environment` is the platform-specific GitLab environment injected through
 * `APP_ENVIRONMENT` (`production/android`, `production/ios`, or `local`).
 */
export function getAppVersionMetadata(): AppVersionMetadata {
  const extra: Partial<AppVersionMetadata> =
    Constants.expoConfig?.extra?.appVersion ?? {};

  return { ...fallbackMetadata, ...extra };
}

/**
 * Formats build metadata as `<MAJOR>.<MINOR>.<PATCH> (<BUILD_ID>.<COMMIT_HASH>)`.
 */
export function formatAppVersion({
  buildId,
  commitHash,
  version,
}: AppVersionMetadata): string {
  return `${version} (${buildId}.${commitHash})`;
}
