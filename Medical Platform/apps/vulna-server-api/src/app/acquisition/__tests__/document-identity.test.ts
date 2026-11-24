import { describe, expect, it } from "vitest"
import { documentIdOfDraft, documentIdOfMove, seriesIdOfDocument } from "../utils/document-identity"

const KEY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

// CAP-021-R29, CAP-021-R39, ADR-050 bod 10
describe("identifier of the document founded with a scan", () => {
	it("is the same for the same key from the device, so a repeated founding writes the same document", () => {
		expect(documentIdOfDraft(KEY)).toBe(documentIdOfDraft(KEY.toUpperCase()))
		expect(documentIdOfDraft(KEY)).not.toBe(documentIdOfDraft("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"))
	})

	it("is a name-based UUID that does not repeat the key", () => {
		const id = documentIdOfDraft(KEY)
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
		expect(id).not.toBe(KEY)
	})

	it("CAP-014-R25 gives the document a new identifier for each visit it moves to, the same again on a repeat", () => {
		const encounter = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
		expect(documentIdOfMove(KEY, encounter)).toBe(documentIdOfMove(KEY.toUpperCase(), encounter.toUpperCase()))
		expect(documentIdOfMove(KEY, encounter)).not.toBe(documentIdOfDraft(KEY))
	})

	it("CAP-021-R28 gives the series of a document the same identifier on a repeated founding", () => {
		const documentId = documentIdOfDraft(KEY)
		expect(seriesIdOfDocument(documentId)).toBe(seriesIdOfDocument(documentId))
		expect(seriesIdOfDocument(documentId)).not.toBe(documentId)
	})
})
