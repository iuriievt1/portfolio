import { ACQUISITION_KIND, ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { ApiProblemError } from "../../../api/api-error"
import { ImageLinkError } from "../../../api/image-link-error"
import type { AcquisitionDetail } from "../../../api/record"
import { REMOTE_FAILURE } from "../../../api/remote-failure"
import cs from "../../../i18n/cs.json"
import { FULL_IMAGE, fullImageFailureOf, THUMBNAIL, thumbnailFailureOf } from "../image-state"
import { fileIdOf, fileTitleOf, isPastPreviewRetention, orderedFilesOf, pageCaptionOf } from "../record-view"

const NOT_FOUND = 404
const GONE = 410
const UNAVAILABLE = 503

describe("orderedFilesOf", () => {
	it("CAP-015-R33 shows the files in the order the server closed them in", () => {
		const files = orderedFilesOf({
			files: [
				{ sequence: 2, page_id: "second" },
				{ sequence: 1, page_id: "first" },
			],
		} as AcquisitionDetail)
		expect(files.map(fileIdOf)).toEqual(["first", "second"])
	})
})

describe("fileTitleOf and pageCaptionOf", () => {
	it("CAP-015-R32 numbers photos and pages of a series", () => {
		expect(fileTitleOf(ACQUISITION_KIND.PHOTO, 0, 3, cs)).toBe("Snímek 1 ze 3")
		expect(fileTitleOf(ACQUISITION_KIND.SCAN, 1, 3, cs)).toBe("Stránka 2 ze 3")
		expect(pageCaptionOf(0, 1, cs)).toBe("Strana 1 z 1")
	})
})

describe("fullImageFailureOf", () => {
	it("CAP-020-S30 tells an original deleted after retention apart from a failure", () => {
		expect(fullImageFailureOf(new ApiProblemError(GONE, ERROR_CODE.RESOURCE_NOT_FOUND))).toEqual({
			kind: FULL_IMAGE.GONE,
		})
	})

	it("CAP-020-S31 shows an unreachable image source as such, not as a lost connection", () => {
		expect(fullImageFailureOf(new ApiProblemError(UNAVAILABLE, ERROR_CODE.IMAGE_SOURCE_UNAVAILABLE))).toEqual({
			kind: FULL_IMAGE.UNAVAILABLE,
		})
	})

	it("CAP-002-R17 reports a lost connection and an unavailable documentation by their own texts", () => {
		expect(fullImageFailureOf(new TypeError("Network request failed"))).toEqual({
			kind: FULL_IMAGE.FAILED,
			failure: REMOTE_FAILURE.NO_CONNECTION,
		})
		expect(fullImageFailureOf(new ApiProblemError(UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE))).toEqual({
			kind: FULL_IMAGE.FAILED,
			failure: REMOTE_FAILURE.DOCUMENTATION_UNAVAILABLE,
		})
	})
})

describe("thumbnailFailureOf", () => {
	it("CAP-020-S31 labels a thumbnail the source cannot give right now", () => {
		expect(thumbnailFailureOf(new ApiProblemError(UNAVAILABLE, ERROR_CODE.IMAGE_SOURCE_UNAVAILABLE))).toEqual({
			kind: THUMBNAIL.UNAVAILABLE,
		})
	})

	it("CAP-020-R10 leaves an expired thumbnail without a picture and without an error", () => {
		expect(thumbnailFailureOf(new ApiProblemError(GONE, undefined))).toEqual({ kind: THUMBNAIL.MISSING })
	})
})

describe("image source failures", () => {
	it("CAP-020-R15 shows a file the server does not know without a picture and without an error", () => {
		expect(fullImageFailureOf(new ApiProblemError(NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND))).toEqual({
			kind: FULL_IMAGE.MISSING,
		})
	})

	it("CAP-020-S31 shows a signed link that cannot be read as an unavailable image, not as a lost connection", () => {
		const failure = new ImageLinkError(new TypeError("Network request failed"))
		expect(fullImageFailureOf(failure)).toEqual({ kind: FULL_IMAGE.UNAVAILABLE })
		expect(thumbnailFailureOf(failure)).toEqual({ kind: THUMBNAIL.UNAVAILABLE })
	})
})

describe("isPastPreviewRetention", () => {
	const THUMBNAIL_URL = "/images/x/thumbnail"

	function detailOf(isAvailable: boolean, thumbnail: string | null): AcquisitionDetail {
		return {
			is_image_data_available: isAvailable,
			files: [{ sequence: 1, image_id: "image", thumbnail_url: thumbnail }],
		} as AcquisitionDetail
	}

	it("CAP-020-S30 keeps quiet while the previews outlive the original", () => {
		expect(isPastPreviewRetention(detailOf(false, THUMBNAIL_URL))).toBe(false)
		expect(isPastPreviewRetention(detailOf(true, THUMBNAIL_URL))).toBe(false)
	})

	it("CAP-020-R07 says the images are only in PACS once the previews are gone too", () => {
		expect(isPastPreviewRetention(detailOf(false, null))).toBe(true)
	})
})
