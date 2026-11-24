import { DOCUMENT_PAGES_PATH, IMAGES_PATH, THUMBNAIL_SEGMENT } from "../constants/image.constants"

// clinical-workflow.yaml TimelineItem.images, getImage
export function imageUrl(imageId: string): string {
	return `/${IMAGES_PATH}/${imageId}`
}

// clinical-workflow.yaml TimelineItem.thumbnail_url, getImageThumbnail
export function imageThumbnailUrl(imageId: string): string {
	return `/${IMAGES_PATH}/${imageId}/${THUMBNAIL_SEGMENT}`
}

// clinical-workflow.yaml AcquisitionDetailFile.thumbnail_url, getDocumentPageThumbnail
export function documentPageThumbnailUrl(pageId: string): string {
	return `/${DOCUMENT_PAGES_PATH}/${pageId}/${THUMBNAIL_SEGMENT}`
}
