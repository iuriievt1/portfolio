import type { PhotoCrop } from "@ansora/core-mobile"
import type { Area } from "./capture-frame"

export const HANDLE_REACH = 16

export interface ShownPhoto {
	left: number
	top: number
	scale: number
	width: number
	height: number
}

export const NOTHING_SHOWN: ShownPhoto = { left: 0, top: 0, scale: 1, width: 0, height: 0 }

export interface CropBox {
	left: number
	top: number
	right: number
	bottom: number
}

// CAP-015-R34
export function shownPhoto(frame: Area, photo: Area): ShownPhoto {
	const scale = Math.min(frame.width / photo.width, frame.height / photo.height)
	const width = photo.width * scale
	const height = photo.height * scale
	return { left: (frame.width - width) / 2, top: (frame.height - height) / 2, scale, width, height }
}

// CAP-015-R34
export function wholeBoxOf(shown: ShownPhoto): CropBox {
	return { left: shown.left, top: shown.top, right: shown.left + shown.width, bottom: shown.top + shown.height }
}

// CAP-015-R34, CAP-015-R03
export function cropOf(box: CropBox, shown: ShownPhoto): PhotoCrop | undefined {
	if (isSameBox(box, wholeBoxOf(shown))) {
		return undefined
	}
	return {
		x: (box.left - shown.left) / shown.scale,
		y: (box.top - shown.top) / shown.scale,
		width: (box.right - box.left) / shown.scale,
		height: (box.bottom - box.top) / shown.scale,
	}
}

function isSameBox(first: CropBox, second: CropBox): boolean {
	return (
		first.left === second.left &&
		first.top === second.top &&
		first.right === second.right &&
		first.bottom === second.bottom
	)
}
