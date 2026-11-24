import { ACQUISITION_KIND } from "@ansora/contracts"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { DocumentRecordService } from "../../clinical-record/services/document-record.service"
import type { FoundedDocumentRecord, WithdrawnDocumentRecord } from "../../clinical-record/types/clinical-record.types"
import { acquisitionRow, ENCOUNTER } from "../../encounter/__tests__/encounter-fixtures"
import type { DocumentRepository } from "../repositories/document.repository"
import { ScanDocumentService } from "../services/scan-document.service"
import type { DocumentSeriesRow } from "../types/acquisition.types"
import { documentIdOfDraft, documentIdOfMove, seriesIdOfDocument } from "../utils/document-identity"
import { DOCUMENT_SERIES_NUMBER, encountersOfId, seriesFake } from "./scan-document-fakes"

const TX = {} as postgres.TransactionSql
const TARGET = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const EXISTING_DOCUMENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const SERIES_UID = "2.25.42"

function harness(existingSeries: DocumentSeriesRow | undefined = undefined) {
	const inserted: string[] = []
	const rekeyed: string[] = []
	const founded: FoundedDocumentRecord[] = []
	const withdrawn: WithdrawnDocumentRecord[] = []
	const series = seriesFake(existingSeries)
	const documents = {
		insert: async (_tx: never, documentId: string) => {
			inserted.push(documentId)
		},
		findByAcquisition: async (_tx: never, acquisitionId: string) => ({
			id: EXISTING_DOCUMENT,
			acquisition_id: acquisitionId,
		}),
		rekey: async (_tx: never, _acquisitionId: string, documentId: string) => {
			rekeyed.push(documentId)
		},
	} as unknown as DocumentRepository
	const records = {
		recordDraft: async (_tx: never, record: FoundedDocumentRecord) => {
			founded.push(record)
		},
		withdrawDraft: async (_tx: never, record: WithdrawnDocumentRecord) => {
			withdrawn.push(record)
		},
	} as unknown as DocumentRecordService
	const service = new ScanDocumentService(documents, series.repository, encountersOfId(), records)
	return { service, series, inserted, rekeyed, founded, withdrawn }
}

const scan = acquisitionRow({ kind: ACQUISITION_KIND.SCAN })

describe("document of a scan in the clinical record CAP-021-R39", () => {
	it("CAP-021-R28 CAP-021-R29 founds the document with its DOC series in the visit of the record", async () => {
		const run = harness()

		await run.service.open(TX, scan)

		const documentId = documentIdOfDraft(scan.idempotency_key)
		expect(run.inserted).toEqual([documentId])
		expect(run.series.locked).toEqual([ENCOUNTER])
		expect(run.series.assigned).toEqual([
			{ owner: { encounterId: ENCOUNTER, documentId }, id: seriesIdOfDocument(documentId) },
		])
		expect(run.founded).toEqual([
			expect.objectContaining({
				documentId,
				acquisitionId: scan.id,
				patientId: scan.patient_id,
				encounter: expect.objectContaining({ id: ENCOUNTER }),
				series: { seriesInstanceUid: `2.25.${seriesIdOfDocument(documentId)}`, number: DOCUMENT_SERIES_NUMBER },
			}),
		])
	})

	it("founds nothing for a wound record", async () => {
		const run = harness()

		await run.service.open(TX, acquisitionRow())
		await run.service.withdraw(TX, acquisitionRow())
		await run.service.refound(TX, acquisitionRow())

		expect([...run.inserted, ...run.rekeyed, ...run.series.removed]).toEqual([])
		expect([...run.founded, ...run.withdrawn]).toEqual([])
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the document with its series and frees the series of the visit", async () => {
		const run = harness({ encounter_id: ENCOUNTER, series_instance_uid: SERIES_UID })

		await run.service.withdraw(TX, scan)

		expect(run.series.locked).toEqual([ENCOUNTER])
		expect(run.withdrawn).toEqual([
			expect.objectContaining({
				documentId: EXISTING_DOCUMENT,
				series: { encounterId: ENCOUNTER, seriesInstanceUid: SERIES_UID },
			}),
		])
		expect(run.series.removed).toEqual([EXISTING_DOCUMENT])
	})

	it("withdraws the document of a scan founded before its series", async () => {
		const run = harness()

		await run.service.withdraw(TX, scan)

		expect(run.withdrawn).toEqual([expect.objectContaining({ documentId: EXISTING_DOCUMENT, series: undefined })])
		expect(run.series.locked).toEqual([])
	})

	it("CAP-014-R25 founds the document of a moved scan again under a new identifier in the new visit", async () => {
		const run = harness()
		const moved = { ...scan, encounter_id: TARGET }

		await run.service.refound(TX, moved)

		const documentId = documentIdOfMove(scan.idempotency_key, TARGET)
		expect(documentId).not.toBe(documentIdOfDraft(scan.idempotency_key))
		expect(run.rekeyed).toEqual([documentId])
		expect(run.series.assigned).toEqual([
			{ owner: { encounterId: TARGET, documentId }, id: seriesIdOfDocument(documentId) },
		])
		expect(run.founded).toEqual([
			expect.objectContaining({ documentId, encounter: expect.objectContaining({ id: TARGET }) }),
		])
	})
})
