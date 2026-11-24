import type { BufferedFile } from "@ansora/core-mobile"
import { jpegDataUriOf } from "../../utils/base64"
import { useThumbnailUri } from "../../utils/thumbnail-cache"
import { thumbnailOf } from "./photo-buffer"

// ADR-026, CAP-009-R17
export function useThumbnail(photo: BufferedFile | undefined): string | undefined {
	return useThumbnailUri(photo?.thumbnailFileId, () => shownThumbnailOf(photo))
}

async function shownThumbnailOf(photo: BufferedFile | undefined): Promise<string> {
	if (photo === undefined) {
		throw new Error("the series tile holds no photo yet")
	}
	return jpegDataUriOf(await thumbnailOf(photo))
}
