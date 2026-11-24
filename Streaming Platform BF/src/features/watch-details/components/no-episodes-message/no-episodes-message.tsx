import { Text } from "@/components";

/** Tells the user a show has no episode to watch right now. */
export function NoEpisodesMessage({
  isTablet = false,
}: {
  isTablet?: boolean;
}) {
  return (
    <Text
      className={`${isTablet ? "text-[18px]" : "text-[14px]"} text-white`}
      testID="no-episodes-message"
      weight="normal"
    >
      No episodes currently available to watch.
    </Text>
  );
}
