import { CONTENT_TYPE_HEADER, IMAGE_RENDITION_HEADER, type MobileContract } from "@ansora/contracts"
import { callApiResponse, JSON_CONTENT_TYPE } from "./client"
import { ImageLinkError } from "./image-link-error"

type ImageDownloadLink = MobileContract.components["schemas"]["ImageDownloadLink"]
export type ImageRendition = MobileContract.components["headers"]["ImageRendition"]

// CAP-021-R40
export const IMAGE_RENDITION = {
	ORIGINAL: "original",
	VIEWING_COPY: "viewing_copy",
} as const satisfies Record<string, ImageRendition>

const RENDITIONS: readonly string[] = Object.values(IMAGE_RENDITION)

export interface DownloadedImage {
	bytes: Uint8Array
	rendition: ImageRendition | undefined
}

function imagePath(imageId: string): string {
	return `/images/${encodeURIComponent(imageId)}`
}

function pagePath(pageId: string): string {
	return `/document-pages/${encodeURIComponent(pageId)}`
}

function thumbnailPath(path: string): string {
	return `${path}/thumbnail`
}

export const imageApi = {
	// ADR-026, CAP-020-R15, ADR-054
	getImageThumbnail: async (sessionToken: string, imageId: string): Promise<Uint8Array> =>
		(await download(thumbnailPath(imagePath(imageId)), sessionToken)).bytes,
	// CAP-020-R09, CAP-020-R15, CAP-021-R40
	getImage: (sessionToken: string, imageId: string): Promise<DownloadedImage> =>
		download(imagePath(imageId), sessionToken),
	// ADR-026, CAP-020-R17
	getDocumentPageThumbnail: async (sessionToken: string, pageId: string): Promise<Uint8Array> =>
		(await download(thumbnailPath(pagePath(pageId)), sessionToken)).bytes,
	// CAP-020-R17, CAP-021-R40
	getDocumentPage: (sessionToken: string, pageId: string): Promise<DownloadedImage> =>
		download(pagePath(pageId), sessionToken),
}

// ADR-054
async function download(path: string, sessionToken: string): Promise<DownloadedImage> {
	const response = await callApiResponse(path, { sessionToken })
	const announced = renditionOf(response.headers.get(IMAGE_RENDITION_HEADER))
	if (!response.headers.get(CONTENT_TYPE_HEADER)?.startsWith(JSON_CONTENT_TYPE)) {
		return { bytes: new Uint8Array(await response.arrayBuffer()), rendition: announced }
	}
	const link = (await response.json()) as ImageDownloadLink
	return { bytes: await linkedBytes(link), rendition: link.rendition ?? announced }
}

// ADR-054, E125
async function linkedBytes(link: ImageDownloadLink): Promise<Uint8Array> {
	try {
		const linked = await fetch(link.download_url)
		if (!linked.ok) {
			throw new Error(`the image download answered ${linked.status}`)
		}
		return new Uint8Array(await linked.arrayBuffer())
	} catch (failure) {
		throw new ImageLinkError(failure)
	}
}

function renditionOf(value: string | null): ImageRendition | undefined {
	return value !== null && RENDITIONS.includes(value) ? (value as ImageRendition) : undefined
}
