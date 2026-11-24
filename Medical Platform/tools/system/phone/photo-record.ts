import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ACQUISITION_KIND, type AcquisitionStateValue } from "@ansora/contracts"
import { FIRST_SEQUENCE, ONE_FILE } from "../support/limits"
import {
	closedRecord,
	identifiedPatientId,
	openedRecord,
	placedWound,
	uploadedFile,
	verifiedConfiguration,
} from "./clinical-flow"
import type { SignedInPhone } from "./signed-in-phone"

// Q-040, quality/data/synteticka-sada/README.md
export const PHOTO = readFileSync(
	resolve(__dirname, "../../../quality/data/synteticka-sada/wounds/photos/R01-overview.jpg"),
)

export interface SubmittedRecord {
	acquisitionId: string
	closedState: AcquisitionStateValue
}

// CAP-013-R01, CAP-015-R30, CAP-016-R17, CAP-021-R25, ADR-024
export async function submittedPhotoRecord(
	{ phone, clinician }: SignedInPhone,
	patientCode: string,
	photo: Buffer = PHOTO,
): Promise<SubmittedRecord> {
	const configuration = await verifiedConfiguration(phone)
	const patientId = await identifiedPatientId(phone, configuration, patientCode)
	const record = await openedRecord(phone, clinician, patientId, ACQUISITION_KIND.PHOTO, configuration)
	await placedWound(phone, record)
	await uploadedFile(phone, record, configuration.serverKey, photo, photo, FIRST_SEQUENCE)
	const receipt = await closedRecord(phone, clinician, record, ONE_FILE)
	return { acquisitionId: record.acquisitionId, closedState: receipt.state }
}
