import { Text } from "@/components";

/** Rail heading, sized and inset for the current form factor. */
export function RailTitle({
  children,
  isLandscape = false,
  isTablet,
}: {
  children: string;
  isLandscape?: boolean;
  isTablet: boolean;
}) {
  return (
    <Text
      accessibilityRole="header"
      className={[
        "text-white",
        isTablet ? "mb-2 px-10" : "px-3",
        isTablet && isLandscape
          ? "text-[20px] leading-6"
          : "text-[18px] leading-[22px]",
      ].join(" ")}
      weight="bold"
    >
      {children}
    </Text>
  );
}
