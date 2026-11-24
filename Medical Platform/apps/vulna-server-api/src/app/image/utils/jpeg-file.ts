import { IMAGE_RENDITION_HEADER } from "@ansora/contracts"
import { CLINICAL_CONTENT_TYPE } from "@ansora/vulna-domain"
import { StreamableFile } from "@nestjs/common"
import type { Response } from "express"
import { RELEASED_FILE } from "../constants/image.constants"
import type { ImageDownloadLinkView, ReleasedFile } from "../types/image.types"

// clinical-workflow.yaml getImage
export function jpegFileOf(bytes: Buffer): StreamableFile {
	return new StreamableFile(bytes, { type: CLINICAL_CONTENT_TYPE.JPEG, length: bytes.length })
}

// clinical-workflow.yaml getImage, getDocumentPage, CAP-020-R15, CAP-020-R22
export function originalFileOf(response: Response, released: ReleasedFile): StreamableFile | ImageDownloadLinkView {
	if (released.kind === RELEASED_FILE.LINK) {
		return released.link
	}
	if (released.rendition !== null) {
		response.setHeader(IMAGE_RENDITION_HEADER, released.rendition)
	}
	return jpegFileOf(released.bytes)
}

// clinical-workflow.yaml getImageThumbnail, getDocumentPageThumbnail, CAP-020-R22
export function thumbnailFileOf(released: ReleasedFile): StreamableFile | ImageDownloadLinkView {
	return released.kind === RELEASED_FILE.LINK ? released.link : jpegFileOf(released.bytes)
}
