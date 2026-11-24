import { useSyncExternalStore } from "react";

import {
  type FeaturevisorContext,
  type FeaturevisorFlagService,
  featurevisorService,
} from "@/infra/feature-flags/featurevisor-service";

type FeatureFlagReader = Pick<
  FeaturevisorFlagService,
  "getSnapshot" | "isEnabled" | "subscribe"
>;

type UseFeatureFlagOptions = {
  context?: FeaturevisorContext;
  fallback?: boolean;
  service?: FeatureFlagReader;
};

/**
 * Subscribes a component to a Featurevisor boolean flag and re-renders when
 * the runtime datafile or local overrides change.
 */
export const useFeatureFlag = (
  key: string,
  {
    context = {},
    fallback = false,
    service = featurevisorService,
  }: UseFeatureFlagOptions = {},
) => {
  useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getSnapshot,
  );

  return service.isEnabled(key, context, fallback);
};

export default useFeatureFlag;
