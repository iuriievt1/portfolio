import sizes from "../../styles/sizes.json"

export interface Area {
	width: number
	height: number
}

// CAP-015-R10
const FRAME_WIDTH_TO_HEIGHT = sizes.photo.width / sizes.photo.height

// CAP-015-R10
export function frameWithin(area: Area): Area {
	const height = Math.min(area.height, area.width / FRAME_WIDTH_TO_HEIGHT)
	return { width: height * FRAME_WIDTH_TO_HEIGHT, height }
}

// Vulna / Capture / Backdrop
export function frameCovering(area: Area): Area {
	const height = Math.max(area.height, area.width / FRAME_WIDTH_TO_HEIGHT)
	return { width: height * FRAME_WIDTH_TO_HEIGHT, height }
}
