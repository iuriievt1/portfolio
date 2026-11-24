import { getAppVersionMetadata } from "@/infra/app-version/app-version-metadata";
import { featureFlagKeys } from "@/infra/feature-flags/feature-keys";
import { featurevisorService } from "@/infra/feature-flags/featurevisor-service";

const MINIMUM_VERSION_VARIABLE = "version";

function toVersionParts(version: string) {
  return version
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isNaN(part) ? 0 : part));
}

export function isVersionBelow({
  minimumVersion,
  version,
}: {
  minimumVersion: string;
  version: string;
}) {
  const current = toVersionParts(version);
  const minimum = toVersionParts(minimumVersion);
  const length = Math.max(current.length, minimum.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = current[index] ?? 0;
    const minimumPart = minimum[index] ?? 0;

    if (currentPart !== minimumPart) {
      return currentPart < minimumPart;
    }
  }

  return false;
}

export function getMinimumAppVersion(): string | undefined {
  const minimumVersion = featurevisorService.getVariable(
    featureFlagKeys.minimumAppVersion,
    MINIMUM_VERSION_VARIABLE,
  );

  return typeof minimumVersion === "string" ? minimumVersion : undefined;
}

/** No minimum published means no update. */
export function isAppUpdateRequired() {
  const minimumVersion = getMinimumAppVersion();

  if (!minimumVersion) {
    return false;
  }

  return isVersionBelow({
    minimumVersion,
    version: getAppVersionMetadata().version,
  });
}
