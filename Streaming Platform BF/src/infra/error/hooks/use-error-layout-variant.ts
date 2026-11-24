import { useDeviceLayout } from "@/hooks/use-device-layout";

type ErrorLayoutVariant = "mobile" | "tablet-landscape" | "tablet-portrait";

/** Shared design variant. */
export function useErrorLayoutVariant(): ErrorLayoutVariant {
  const { isLandscape, isTablet } = useDeviceLayout();

  if (!isTablet) {
    return "mobile";
  }

  return isLandscape ? "tablet-landscape" : "tablet-portrait";
}
