import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
	ACQUISITION_KIND,
	ACQUISITION_STATE_VALUE,
	type AcquisitionStateValue,
	DELIVERY_INSTANCE_STATE,
} from "@ansora/contracts"
import { SOP_CLASS } from "@ansora/vulna-domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { isTextLayerInvisible, pageTextsOf, titleOf, withoutSpaces } from "../pacs/pdf-text"
import type { DicomTags } from "../pacs/synthetic-pacs"
import {
	closedRecord,
	identifiedPatientId,
	openedRecord,
	titledDocument,
	uploadedFile,
	verifiedConfiguration,
} from "../phone/clinical-flow"
import { signedInPhone } from "../phone/signed-in-phone"
import { type DeliveredInstance, settledDeliveryOf } from "../server/delivery"
import { systemContext } from "../support/context"
import { DELIVERY_TIMEOUT_MILLISECONDS, FIRST_SEQUENCE, ONE_FILE } from "../support/limits"

// Q-040, quality/data/synteticka-sada/README.md
const SCAN_DIRECTORY = resolve(__dirname, "../../../quality/data/synteticka-sada/scan")
const CZECH_PAGE = readFileSync(resolve(SCAN_DIRECTORY, "ladder/page-cs-light.jpg"))
const BLANK_PAGE = readFileSync(resolve(SCAN_DIRECTORY, "page-blank.jpg"))
const PAGES = [CZECH_PAGE, BLANK_PAGE]
const CZECH_TEXT = "Příliš žluťoučký kůň úpěl ďábelské ódy."
const TITLE = "Propouštěcí zpráva"
// quality/data/synteticka-sada/registry.json
const PATIENT_CODE = "1000102"
const CLINICIAN_LABEL = "system-scan"
// integrace-dicom.md 5.1
const DOCUMENT_MODALITY = "DOC"

describe("ADR-024 a scanned document from the phone through OCR to the synthetic PACS", () => {
	const context = systemContext()
	let closedState: AcquisitionStateValue
	let instance: DeliveredInstance
	let tags: DicomTags
	let pdf: Buffer

	beforeAll(async () => {
		const { phone, clinician } = await signedInPhone(context.sql, context.environment.apiUrl, CLINICIAN_LABEL)
		const configuration = await verifiedConfiguration(phone)
		const patientId = await identifiedPatientId(phone, configuration, PATIENT_CODE)
		const record = await openedRecord(phone, clinician, patientId, ACQUISITION_KIND.SCAN, configuration)
		for (const [index, page] of PAGES.entries()) {
			await uploadedFile(phone, record, configuration.serverKey, page, page, FIRST_SEQUENCE + index)
		}
		await titledDocument(phone, record, TITLE)
		closedState = (await closedRecord(phone, clinician, record, PAGES.length)).state
		const [delivered] = await settledDeliveryOf(
			context.sql,
			record.acquisitionId,
			ONE_FILE,
			DELIVERY_TIMEOUT_MILLISECONDS,
		)
		if (delivered === undefined) {
			throw new Error(`no instance of ${record.acquisitionId} was delivered`)
		}
		instance = delivered
		const instanceId = await context.pacs.instanceIdOf(instance.sopInstanceUid)
		tags = await context.pacs.tagsOf(instanceId)
		pdf = await context.pacs.encapsulatedDocumentOf(instanceId)
	})

	afterAll(async () => {
		await context.close()
	})

	it("CAP-021-S01 receives the closed document", () => {
		expect(closedState).toBe(ACQUISITION_STATE_VALUE.RECEIVED)
	})

	it("CAP-023-R09 confirms the one Encapsulated PDF after C-STORE", () => {
		expect(instance.state).toBe(DELIVERY_INSTANCE_STATE.CONFIRMED)
		expect(instance.sopClassUid).toBe(SOP_CLASS.ENCAPSULATED_PDF)
	})

	it("CAP-018-R15, CAP-022-R16 stores the PDF of the identified patient under the title of the document", () => {
		expect(tags.SOPClassUID).toBe(SOP_CLASS.ENCAPSULATED_PDF)
		expect(tags.Modality).toBe(DOCUMENT_MODALITY)
		expect(tags.PatientID).toBe(PATIENT_CODE)
		expect(tags.DocumentTitle).toBe(TITLE)
		expect(titleOf(pdf)).toBe(TITLE)
	})

	it("CAP-022-S01 puts an invisible searchable text layer over the Czech page", () => {
		const [czech] = pageTextsOf(pdf)

		expect(withoutSpaces(czech ?? "")).toContain(withoutSpaces(CZECH_TEXT))
		expect(isTextLayerInvisible(pdf)).toBe(true)
	})

	it("CAP-022-S02 keeps the blank page with an empty text layer", () => {
		const texts = pageTextsOf(pdf)

		expect(texts).toHaveLength(PAGES.length)
		expect(texts[1]).toBe("")
	})
})
