import type { ComponentProps } from "react";
import { ContentRail } from "@/features/content-rails/components/content-rail/content-rail";
import { useContinueWatching } from "@/features/continue-watching";

/** GO's Continue Watching rail, filled from the profile's Continue Watching list. */
export function ContinueWatchingRail({
  rail,
  ...props
}: ComponentProps<typeof ContentRail>) {
  const { data } = useContinueWatching();

  // GO's page items show while loading, or if the request fails.
  return (
    <ContentRail
      rail={data ? { ...rail, items: data.items } : rail}
      {...props}
    />
  );
}
