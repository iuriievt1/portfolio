import "reflect-metadata"
import { ERROR_CODE, IMAGE_RENDITION_HEADER } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import { HEADERS_METADATA } from "@nestjs/common/constants"
import type { Response } from "express"
import { describe, expect, it } from "vitest"
import { CURRENT, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { IMAGE_RENDITION, RELEASED_FILE } from "../constants/image.constants"
import { DocumentPageController } from "../controllers/document-page.controller"
import { ImageController } from "../controllers/image.controller"
import type { FileReleaseService } from "../services/file-release.service"
import type { ReleasedFile } from "../types/image.types"
import { jpegFileOf } from "../utils/jpeg-file"
import { IMAGE } from "./image-fixtures"

const BYTES = Buffer.from("jpeg bytes")

interface HeaderMetadata {
	name: string
	value: string
}

function headersOf(handler: object): HeaderMetadata[] {
	return Reflect.getMetadata(HEADERS_METADATA, handler) as HeaderMetadata[]
}

function harness(release: () => Promise<ReleasedFile>) {
	const headers = new Map<string, string>()
	const response = {
		setHeader: (name: string, value: string) => {
			headers.set(name, value)
		},
	} as unknown as Response
	const releases = { image: release, documentPage: release } as unknown as FileReleaseService
	return {
		headers,
		response,
		images: new ImageController(releases),
		pages: new DocumentPageController(releases),
	}
}

async function gone(): Promise<ReleasedFile> {
	throw new ProblemException(HttpStatus.GONE, ERROR_CODE.RESOURCE_NOT_FOUND)
}

describe("image response clinical-workflow.yaml getImage", () => {
	it("CAP-020-R22 sends the bytes as image/jpeg of their length", () => {
		expect(jpegFileOf(BYTES).getHeaders()).toEqual(
			expect.objectContaining({ type: "image/jpeg", length: BYTES.length }),
		)
	})

	it("CAP-020-R15 marks a released full image or page as the original", async () => {
		const run = harness(async () => ({ kind: RELEASED_FILE.BYTES, bytes: BYTES, rendition: IMAGE_RENDITION.ORIGINAL }))

		await run.images.getImage(CURRENT, IMAGE, run.response)
		expect(run.headers.get(IMAGE_RENDITION_HEADER)).toBe("original")
		run.headers.clear()
		await run.pages.getDocumentPage(CURRENT, IMAGE, run.response)
		expect(run.headers.get(IMAGE_RENDITION_HEADER)).toBe("original")
	})

	it("CAP-020-R15 marks the viewing copy released in place of an original past its retention", async () => {
		const run = harness(async () => ({
			kind: RELEASED_FILE.BYTES,
			bytes: BYTES,
			rendition: IMAGE_RENDITION.VIEWING_COPY,
		}))

		await run.images.getImage(CURRENT, IMAGE, run.response)
		expect(run.headers.get(IMAGE_RENDITION_HEADER)).toBe("viewing_copy")
	})

	it("CAP-020-R15 leaves the rendition out of an error response", async () => {
		const run = harness(gone)

		await problemOf(run.images.getImage(CURRENT, IMAGE, run.response))
		await problemOf(run.pages.getDocumentPage(CURRENT, IMAGE, run.response))

		expect(run.headers.has(IMAGE_RENDITION_HEADER)).toBe(false)
	})

	it("CAP-020-S28 answers a file kept only in the store with the signed link instead of bytes", async () => {
		const link = {
			download_url: "https://vulna.invalid/storage/b",
			expires_at: "2026-10-22T10:05:00.000Z",
			rendition: null,
		}
		const run = harness(async () => ({ kind: RELEASED_FILE.LINK, link }))

		expect(await run.images.getImage(CURRENT, IMAGE, run.response)).toEqual(link)
		expect(await run.pages.getDocumentPageThumbnail(CURRENT, IMAGE)).toEqual(link)
		expect(run.headers.has(IMAGE_RENDITION_HEADER)).toBe(false)
	})

	it("CAP-020-R10 never marks a thumbnail with a rendition", () => {
		for (const handler of [
			ImageController.prototype.getImage,
			ImageController.prototype.getImageThumbnail,
			DocumentPageController.prototype.getDocumentPage,
			DocumentPageController.prototype.getDocumentPageThumbnail,
		]) {
			expect(headersOf(handler).map((header) => header.name)).not.toContain(IMAGE_RENDITION_HEADER)
		}
	})

	it("CAP-020-R02 keeps every released image out of HTTP caches", () => {
		const noStore = { name: "Cache-Control", value: "no-store" }

		for (const handler of [
			ImageController.prototype.getImage,
			ImageController.prototype.getImageThumbnail,
			DocumentPageController.prototype.getDocumentPage,
			DocumentPageController.prototype.getDocumentPageThumbnail,
		]) {
			expect(headersOf(handler)).toContainEqual(noStore)
		}
	})
})
