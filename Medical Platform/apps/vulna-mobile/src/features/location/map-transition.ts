import { Easing } from "react-native-reanimated"

// CAP-016-R17
export const SHOWN = 1
export const HIDDEN = 0
export const NATURAL_SCALE = 1
export const FADE_OUT = { duration: 120, easing: Easing.in(Easing.quad) } as const
export const FADE_IN = { duration: 240, easing: Easing.out(Easing.cubic) } as const
export const FADE_IN_DELAY = 60
export const DEPTH = { duration: FADE_IN_DELAY + FADE_IN.duration, easing: Easing.out(Easing.cubic) } as const
export const FOCUSED_FAR_SCALE = 0.94
export const ALL_VIEWS_NEAR_SCALE = 1.04
export const FOOTER_FADE_OUT = { duration: 100, easing: Easing.in(Easing.quad) } as const
export const FOOTER_FADE_IN = { duration: 200, easing: Easing.out(Easing.cubic) } as const
export const FOOTER_FADE_IN_DELAY = FOOTER_FADE_OUT.duration
