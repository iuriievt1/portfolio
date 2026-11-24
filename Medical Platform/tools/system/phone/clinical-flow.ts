import { randomUUID } from "node:crypto"
import {
	ACQUISITION_KIND,
	ACQUISITION_VERSION_HEADER,
	type AcquisitionKind,
	BODY_VIEW,
	IDEMPOTENCY_KEY_HEADER,
	LATERALITY,
	type MobileContract,
	normalizedPointInRegion,
	PATIENT_IDENTIFICATION_METHOD,
	REQUEST_KEY_HEADER,
} from "@ansora/contracts"
import { deserializePublicKey, HPKE_SUITE, seal, sha256Hex } from "@ansora/core-server"
import { CURRENT_BODY_DIAGRAM } from "@ansora/vulna-domain"
import type { Clinician } from "../server/clinician"
import type { SystemPhone } from "./phone"

type Schemas = MobileContract.components["schemas"]
type DeviceState = Schemas["DeviceState"]
type PatientSearchResult = Schemas["PatientSearchResult"]
type AcquisitionReceipt = Schemas["AcquisitionReceipt"]
type AcquisitionDraft = Schemas["AcquisitionDraft"]
type AnnouncementReceipt = Schemas["AcquisitionFileAnnouncementReceipt"]
type BodySite = Schemas["BodySite"]
type FileKind = Schemas["AcquisitionFileAnnouncement"]["file_kind"]
type UploadPart = keyof Schemas["ImageUpload"] | keyof Schemas["DocumentPageUpload"]

// libs/modules/vulna/domain/src/body-diagram/regions-2.ts, CAP-016-R06
const LOWER_LEG_REGION = "25763004"
const BASE64URL = "base64url"
const SEALED_PART_TYPE = "application/octet-stream"
// clinical-workflow.yaml DocumentPageUpload is_last, CAP-021-R25
const NOT_LAST_PAGE = String(false)

interface UploadOfKind {
	fileKind: FileKind
	collection: "images" | "documents"
	contentPart: UploadPart
	kindFields: Partial<Record<UploadPart, string>>
}

// clinical-workflow.yaml uploadImage, uploadDocumentPage, apps/vulna-mobile/src/features/upload/upload-request.ts
const UPLOAD_OF_KIND: Readonly<Record<AcquisitionKind, UploadOfKind>> = {
	[ACQUISITION_KIND.PHOTO]: { fileKind: "image", collection: "images", contentPart: "image", kindFields: {} },
	[ACQUISITION_KIND.SCAN]: {
		fileKind: "document_page",
		collection: "documents",
		contentPart: "page",
		kindFields: { is_last: NOT_LAST_PAGE },
	},
}

export interface ServerKey {
	publicKey: string
	version: string
}

export interface VerifiedConfiguration {
	serverKey: ServerKey
	version: number
	patientCodeSystem: string
}

export interface OpenRecord {
	acquisitionId: string
	kind: AcquisitionKind
}

function versionTagOf(version: number): string {
	return `"${version}"`
}

// CAP-016-R06, CAP-016-R11
function lowerLegSite(): BodySite {
	const view = BODY_VIEW.ANTERIOR
	const drawn = CURRENT_BODY_DIAGRAM.views[view]
	const point =
		drawn === undefined ? undefined : normalizedPointInRegion(view, drawn, LOWER_LEG_REGION, LATERALITY.RIGHT)
	if (point === undefined) {
		throw new Error(`the body diagram ${CURRENT_BODY_DIAGRAM.version} has no right lower leg in the anterior view`)
	}
	return {
		region_code: LOWER_LEG_REGION,
		laterality: LATERALITY.RIGHT,
		view,
		x: point.x,
		y: point.y,
		body_diagram_version: CURRENT_BODY_DIAGRAM.version,
	}
}

// CAP-009-R13, ADR-015
function sealed(bytes: Buffer, key: ServerKey): { ciphertext: Buffer; envelope: string } {
	const message = seal(deserializePublicKey(Buffer.from(key.publicKey, BASE64URL)), bytes)
	const envelope = { enc: message.enc.toString(BASE64URL), suite: HPKE_SUITE, server_key_version: key.version }
	return { ciphertext: message.ciphertext, envelope: JSON.stringify(envelope) }
}

// CAP-006-R08, CAP-012-R30, CAP-013-R03, apps/vulna-mobile/src/api/device.ts
export async function verifiedConfiguration(phone: SystemPhone): Promise<VerifiedConfiguration> {
	const state = await phone.call<DeviceState>("/device/verification", { method: "POST", isDeviceOnly: true })
	const configuration = state.effective_configuration
	const hpke = configuration?.server_hpke_key
	const patientCode = configuration?.patient_code ?? undefined
	if (configuration?.version === undefined || hpke === undefined || patientCode === undefined) {
		throw new Error(
			`the device verification carries no configuration, server key or patient code: ${JSON.stringify(state)}`,
		)
	}
	return {
		serverKey: { publicKey: hpke.public_key, version: hpke.server_key_version },
		version: configuration.version,
		patientCodeSystem: patientCode.system,
	}
}

// CAP-013-R01, CAP-013-R10, ADR-039
export async function identifiedPatientId(
	phone: SystemPhone,
	configuration: VerifiedConfiguration,
	patientCode: string,
): Promise<string> {
	const result = await phone.call<PatientSearchResult>("/patients/identification", {
		method: "POST",
		body: {
			search_method: PATIENT_IDENTIFICATION_METHOD.CODE,
			system: configuration.patientCodeSystem,
			value: patientCode,
		} satisfies Schemas["PatientIdentification"],
	})
	const [patient, ...others] = result.items
	if (patient === undefined || others.length > 0) {
		throw new Error(`the code ${patientCode} identified ${result.items.length} patients instead of one`)
	}
	return patient.patient_id
}

// CAP-015-R30, CAP-014-R06, ADR-047
export async function openedRecord(
	phone: SystemPhone,
	clinician: Clinician,
	patientId: string,
	kind: AcquisitionKind,
	configuration: VerifiedConfiguration,
): Promise<OpenRecord> {
	const receipt = await phone.call<AcquisitionReceipt>("/acquisitions", {
		method: "POST",
		headers: { [IDEMPOTENCY_KEY_HEADER]: randomUUID() },
		body: {
			operator: { user_id: clinician.userId, session_id: clinician.sessionId },
			patient_id: patientId,
			encounter_key: randomUUID(),
			kind,
			started_at: new Date().toISOString(),
			configuration_version: configuration.version,
		} satisfies Schemas["AcquisitionDraftCreate"],
	})
	return { acquisitionId: receipt.acquisition_id, kind }
}

// CAP-015-R15
export async function draftOf(phone: SystemPhone, record: OpenRecord): Promise<AcquisitionDraft> {
	return await phone.call<AcquisitionDraft>(`/acquisitions/${record.acquisitionId}`)
}

// CAP-015-R35, CAP-021-R23, CAP-021-R29, ADR-014, ADR-015
export async function uploadedFile(
	phone: SystemPhone,
	record: OpenRecord,
	key: ServerKey,
	file: Buffer,
	thumbnail: Buffer,
	sequence: number,
	fileKey: string = randomUUID(),
): Promise<string> {
	const upload = UPLOAD_OF_KIND[record.kind]
	const digest = sha256Hex(file)
	await phone.call<AnnouncementReceipt>(`/acquisitions/${record.acquisitionId}/files`, {
		method: "POST",
		headers: { [IDEMPOTENCY_KEY_HEADER]: fileKey },
		body: { file_kind: upload.fileKind, sha256: digest } satisfies Schemas["AcquisitionFileAnnouncement"],
	})
	const sealedFile = sealed(file, key)
	const sealedThumbnail = sealed(thumbnail, key)
	const fields: Partial<Record<UploadPart, string>> = {
		encryption: sealedFile.envelope,
		thumbnail_encryption: sealedThumbnail.envelope,
		sha256: digest,
		sequence: String(sequence),
		...upload.kindFields,
	}
	const form = new FormData()
	for (const [name, value] of Object.entries(fields)) {
		form.set(name, value)
	}
	form.set(upload.contentPart, new Blob([new Uint8Array(sealedFile.ciphertext)], { type: SEALED_PART_TYPE }), fileKey)
	form.set("thumbnail", new Blob([new Uint8Array(sealedThumbnail.ciphertext)], { type: SEALED_PART_TYPE }), fileKey)
	await phone.call(`/acquisitions/${record.acquisitionId}/${upload.collection}`, {
		method: "POST",
		headers: { [IDEMPOTENCY_KEY_HEADER]: fileKey },
		form,
	})
	return fileKey
}

async function updatedDraft(
	phone: SystemPhone,
	record: OpenRecord,
	update: Schemas["AcquisitionDraftUpdate"],
): Promise<AcquisitionDraft> {
	const draft = await draftOf(phone, record)
	return await phone.call<AcquisitionDraft>(`/acquisitions/${record.acquisitionId}`, {
		method: "PATCH",
		headers: { [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version), [REQUEST_KEY_HEADER]: randomUUID() },
		body: update,
	})
}

// CAP-015-R31, CAP-016-R17
export async function placedWound(phone: SystemPhone, record: OpenRecord): Promise<void> {
	await updatedDraft(phone, record, { finding_key: randomUUID(), body_site: lowerLegSite() })
}

// CAP-017-R01, CAP-017-R04
export async function describedFinding(phone: SystemPhone, record: OpenRecord, description: string): Promise<void> {
	await updatedDraft(phone, record, { assessment: { description } })
}

// CAP-018-R15, CAP-017-R16
export async function titledDocument(phone: SystemPhone, record: OpenRecord, title: string): Promise<void> {
	await updatedDraft(phone, record, { document_title: { text: title } })
}

// CAP-021-R25, CAP-021-R29
export async function closedRecord(
	phone: SystemPhone,
	clinician: Clinician,
	record: OpenRecord,
	fileCount: number,
): Promise<AcquisitionReceipt> {
	const draft = await draftOf(phone, record)
	return await phone.call<AcquisitionReceipt>(`/acquisitions/${record.acquisitionId}/closure`, {
		method: "POST",
		headers: { [ACQUISITION_VERSION_HEADER]: versionTagOf(draft.version) },
		body: {
			file_count: fileCount,
			completed_at: new Date().toISOString(),
			operator: { user_id: clinician.userId, session_id: clinician.sessionId },
		} satisfies Schemas["AcquisitionClosure"],
	})
}
