import type { ClinicalDraftDocument } from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { draftDocumentOf } from "../document-resources"
import { FINDING_RECORD } from "../draft-records"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"

const INSTANCE_BASE = "https://fhir.mou.cz/vulna"
const systems = identifierSystemsOf(DEFAULT_CANONICAL_BASE)
const context = { systems, instanceBase: `${INSTANCE_BASE}/` }
const DEPARTMENT_ID = "33333333-3333-4333-8333-333333333333"

const document: ClinicalDraftDocument = {
	documentId: "66666666-6666-4666-8666-666666666666",
	acquisitionId: "55555555-5555-4555-8555-555555555555",
	department: { id: DEPARTMENT_ID, code: "KOC" },
}

describe("scanned document of a draft record CAP-021-R39", () => {
	const draft = draftDocumentOf(document, FINDING_RECORD.DRAFT, context)

	it("is preliminary from the moment the record is founded, under the draft and the department tag", () => {
		expect(draft.status).toBe("current")
		expect(draft.docStatus).toBe("preliminary")
		expect(draft.identifier).toEqual([
			{ system: systems.document, value: document.documentId },
			{ system: systems.acquisition, value: document.acquisitionId },
		])
		expect(draft.meta?.profile).toEqual([systems.scannedDocumentProfile])
		expect(draft.meta?.tag).toContainEqual({ system: systems.draftTag, code: document.acquisitionId })
		expect(draft.meta?.tag).toContainEqual({ system: systems.departmentTag, code: DEPARTMENT_ID })
	})

	it("CAP-021-S34 names neither the patient, the visit nor the author until the record is closed", () => {
		expect(draft.subject).toBeUndefined()
		expect(draft.context).toBeUndefined()
		expect(draft.author).toBeUndefined()
		expect(draft.date).toBeUndefined()
		expect(draft.type).toBeUndefined()
	})

	it("holds a PDF without pages, so the store accepts the resource before the first page", () => {
		expect(draft.content).toEqual([
			{
				attachment: { contentType: "application/pdf" },
				format: {
					system: "http://ihe.net/fhir/ihe.formatcode.fhir/CodeSystem/formatcode",
					code: "urn:ihe:iti:xds-sd:pdf:2008",
				},
			},
		])
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the document as entered in error and leaves it preliminary", () => {
		const withdrawn = draftDocumentOf(document, FINDING_RECORD.WITHDRAWN, context)

		expect(withdrawn.status).toBe("entered-in-error")
		expect(withdrawn.docStatus).toBe("preliminary")
		expect(withdrawn.meta?.tag).toContainEqual({ system: systems.draftTag, code: document.acquisitionId })
	})
})
