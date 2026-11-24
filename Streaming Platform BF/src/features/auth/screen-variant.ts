export type ScreenVariant = "mobile" | "tablet-landscape" | "tablet-portrait";

const TABLET_BUTTON_LABEL_CLASSNAME =
  "font-bold text-[16px] text-dark-slate-blue";

export const AUTH_BUTTON_LABEL_CLASSNAME: Record<ScreenVariant, string> = {
  mobile: "font-bold text-[14px] text-dark-slate-blue",
  "tablet-landscape": TABLET_BUTTON_LABEL_CLASSNAME,
  "tablet-portrait": TABLET_BUTTON_LABEL_CLASSNAME,
};

/** Shared layout variant. */
export function getScreenVariant({
  isLandscape,
  isTablet,
}: {
  isLandscape: boolean;
  isTablet: boolean;
}): ScreenVariant {
  if (!isTablet) {
    return "mobile";
  }

  return isLandscape ? "tablet-landscape" : "tablet-portrait";
}
