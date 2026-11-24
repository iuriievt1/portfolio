import { ACQUISITION_KIND } from "@ansora/contracts"
import { HPKE_SUITE } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { DEVICE } from "../../encounter/__tests__/encounter-fixtures"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { FILE_STATUS, PART } from "../constants/acquisition-file.constants"
import { acquisitionDraftFileViewOf } from "../utils/acquisition-file-view"
import { sealedContentOf } from "../utils/sealed-content"
import { FakeFiles, FILE_A, KEY_VERSION, OTHER_DEVICE } from "./acquisition-file-fixtures"

const ENVELOPE = { enc: "AQID", suite: HPKE_SUITE, server_key_version: KEY_VERSION }
const PART_OF = (bytes: string) => [{ buffer: Buffer.from(bytes), size: bytes.length }]

describe("file of a draft record CAP-015-R35", () => {
	it("CAP-015-S51 marks a file announced from another device as pending there", () => {
		const files = new FakeFiles()
		const file = files.add({ file_key: FILE_A, announced_by_device_id: OTHER_DEVICE })

		expect(acquisitionDraftFileViewOf(ACQUISITION_KIND.PHOTO, file, DEVICE)).toMatchObject({
			file_key: FILE_A,
			status: FILE_STATUS.ANNOUNCED,
			pending_on_other_device: true,
			thumbnail_url: null,
			image_id: file.id,
			page_id: null,
		})
	})

	it("links the thumbnail of a received page", () => {
		const files = new FakeFiles()
		const file = files.received(FILE_A, { kind: ACQUISITION_KIND.SCAN })

		expect(acquisitionDraftFileViewOf(ACQUISITION_KIND.SCAN, file, DEVICE)).toMatchObject({
			status: FILE_STATUS.RECEIVED,
			pending_on_other_device: false,
			thumbnail_url: `/document-pages/${file.id}/thumbnail`,
			image_id: null,
			page_id: file.id,
		})
	})
})

describe("multipart upload with HPKE envelopes CAP-021-R21", () => {
	it("needs the image part", () => {
		expect(() => sealedContentOf({}, PART.IMAGE, {})).toThrow(ProblemException)
	})

	it("CAP-009-R13 needs the thumbnail envelope when the image is sealed", () => {
		const parts = { image: PART_OF("sealed"), thumbnail: PART_OF("sealed thumbnail") }

		expect(() => sealedContentOf(parts, PART.IMAGE, { encryption: ENVELOPE })).toThrow(ProblemException)
	})

	it("refuses a thumbnail envelope without a sealed image", () => {
		const parts = { image: PART_OF("plain"), thumbnail: PART_OF("thumbnail") }

		expect(() => sealedContentOf(parts, PART.IMAGE, { thumbnail_encryption: ENVELOPE })).toThrow(ProblemException)
	})

	it("keeps both envelopes with their parts", () => {
		const parts = { image: PART_OF("sealed"), thumbnail: PART_OF("sealed thumbnail") }

		expect(sealedContentOf(parts, PART.IMAGE, { encryption: ENVELOPE, thumbnail_encryption: ENVELOPE })).toEqual({
			file: Buffer.from("sealed"),
			thumbnail: Buffer.from("sealed thumbnail"),
			encryption: ENVELOPE,
			thumbnailEncryption: ENVELOPE,
		})
	})
})
