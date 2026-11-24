import { describe, expect, it } from "vitest"
import { sealedFieldsOf, sealedFilesOf } from "../../../api/acquisition-file-parts"
import { uploadCollectionOf, uploadRequestOf } from "../upload-request"

const SUITE = "DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM" as const
const SHA256 = "ab".repeat(32)
const FILE_KEY = "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10"

const SEALED = {
	file: { path: "/vault/queue/sealed", envelope: { enc: "content-enc", suite: SUITE, server_key_version: "1" } },
	thumbnail: {
		path: "/vault/queue/sealed-thumbnail",
		envelope: { enc: "thumbnail-enc", suite: SUITE, server_key_version: "1" },
	},
	sha256: SHA256,
}

function upload(kind: "image" | "document_page") {
	return {
		fileKey: FILE_KEY,
		kind,
		sequence: 2,
		url: "https://vulna.example/api/v1/acquisitions/a/images",
		headers: { DPoP: "proof" },
		sealed: SEALED,
		announcement: null,
		delayMs: 0,
	}
}

const ANNOUNCEMENT = {
	url: "https://vulna.example/api/v1/acquisitions/a/files",
	body: JSON.stringify({ file_kind: "image", sha256: SHA256 }),
	headers: { "Idempotency-Key": FILE_KEY },
	verificationUrl: "https://vulna.example/api/v1/device/verification",
	verificationHeaders: {},
}

describe("uploadRequestOf", () => {
	it("CAP-021-R21 CAP-009-R13 sends the photo and its thumbnail each in its own envelope", () => {
		const request = uploadRequestOf(upload("image"))

		expect(request.id).toBe(FILE_KEY)
		expect(request.files.map((file) => [file.name, file.path])).toEqual([
			["image", "/vault/queue/sealed"],
			["thumbnail", "/vault/queue/sealed-thumbnail"],
		])
		expect(Object.fromEntries(request.fields.map((field) => [field.name, field.value]))).toEqual({
			encryption: JSON.stringify({ enc: "content-enc", suite: SUITE, server_key_version: "1" }),
			thumbnail_encryption: JSON.stringify({ enc: "thumbnail-enc", suite: SUITE, server_key_version: "1" }),
			sha256: SHA256,
			sequence: "2",
		})
	})

	it("CAP-018-R08 CAP-021-R25 sends a page as a page that does not close the document", () => {
		const request = uploadRequestOf(upload("document_page"))

		expect(request.files[0]?.name).toBe("page")
		expect(request.fields.find((field) => field.name === "is_last")?.value).toBe("false")
	})

	it("picks the collection by the kind of the file", () => {
		expect(uploadCollectionOf("image")).toBe("images")
		expect(uploadCollectionOf("document_page")).toBe("documents")
	})
})

describe("sealed parts", () => {
	it("CAP-015-R34 CAP-021-R21 seals an edited file the same way as an uploaded one", () => {
		expect(sealedFieldsOf(SEALED)).toEqual(uploadRequestOf(upload("image")).fields.slice(0, 3))
		expect(sealedFilesOf(SEALED, "file", FILE_KEY).map((file) => [file.name, file.filename])).toEqual([
			["file", FILE_KEY],
			["thumbnail", FILE_KEY],
		])
	})

	it("ADR-014 CAP-019-R32 hands the system the announcement and the time it waits for the session", () => {
		const request = uploadRequestOf({ ...upload("image"), announcement: ANNOUNCEMENT, delayMs: 60_000 })

		expect(request.announcement).toEqual(ANNOUNCEMENT)
		expect(request.delayMs).toBe(60_000)
	})
})
