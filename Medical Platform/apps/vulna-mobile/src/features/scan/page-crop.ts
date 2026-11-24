import { type BufferedFile, documentScanner, FILE_EDIT, type FileEdit, type PageCorners } from "@ansora/core-mobile"
import { recropScannedPage } from "../capture/photo-buffer"
import { pageGeometryOf, plainCornersOf, quarterTurnsOf } from "./page-geometry"
import { cornersOf } from "./scanned-page"

const QUARTER_TURN = 1

// CAP-018-R10, CAP-018-R11, NAB-191–195
export async function recropPage(acquisitionId: string, page: BufferedFile, corners: PageCorners): Promise<void> {
	await renderPage(acquisitionId, page, corners, quarterTurnsOf(page), FILE_EDIT.CROP)
}

// CAP-018-R11, CAP-015-R34
export async function rotatePage(acquisitionId: string, page: BufferedFile): Promise<void> {
	await renderPage(acquisitionId, page, cornersOf(page), quarterTurnsOf(page) + QUARTER_TURN, FILE_EDIT.ROTATION)
}

// CAP-018-R11
async function renderPage(
	acquisitionId: string,
	page: BufferedFile,
	corners: PageCorners,
	quarterTurns: number,
	edit: FileEdit,
): Promise<void> {
	await recropScannedPage(acquisitionId, page, edit, async (original) => {
		const scanner = documentScanner()
		if (scanner === undefined) {
			throw new Error("the document scanner is not available")
		}
		const cropped = await scanner.recropPage(original, plainCornersOf(corners), quarterTurns)
		return {
			image: cropped.page,
			thumbnail: cropped.thumbnail,
			width: cropped.width,
			height: cropped.height,
			corners: pageGeometryOf(cropped.corners ?? corners, quarterTurns),
		}
	})
}
