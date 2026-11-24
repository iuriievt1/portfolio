// CAP-016-R20, Q-146, ADR-050
export const BODY_SURFACE = {
	ANTERIOR: "anterior",
	POSTERIOR: "posterior",
	PLANTAR: "plantar",
	MEDIAL: "medial",
	LATERAL: "lateral",
} as const

export type BodySurface = (typeof BODY_SURFACE)[keyof typeof BODY_SURFACE]
