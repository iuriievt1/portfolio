import {
	type DimseTarget,
	type FindQuery,
	INFORMATION_MODEL,
	type StoredArtifact,
	type StoredVariant,
} from "@ansora/vulna-adapter-dicom-dimse"
import { Dataset } from "@veevoy/dcmjs-dimse"
import { CALLING_AE_TITLE, LOOPBACK_HOST, SYNTHETIC_PATIENT_ID } from "../synthetic"
import { SECONDARY_CAPTURE_IMAGE_STORAGE } from "../uids"
import { syntheticPart10 } from "./part10"
import { sha256 } from "./support"

// integrace-dicom.md 6.1, 6.4

const PIXEL_BYTES = 40_000
const UNREACHED_PORT = 104

export const UNREACHED_TARGET: DimseTarget = {
	host: LOOPBACK_HOST,
	port: UNREACHED_PORT,
	callingAeTitle: CALLING_AE_TITLE,
	calledAeTitle: "BASELINE",
}

export function targetAt(port: number, calledAeTitle: string, extra: Partial<DimseTarget> = {}): DimseTarget {
	return { host: LOOPBACK_HOST, port, callingAeTitle: CALLING_AE_TITLE, calledAeTitle, ...extra }
}

export function variantOf(transferSyntaxUid: string, sopInstanceUid: string, pixelBytes = PIXEL_BYTES): StoredVariant {
	const part10 = syntheticPart10(transferSyntaxUid, pixelBytes, sopInstanceUid)
	return { transferSyntaxUid, part10, datasetSha256: sha256(Dataset.fromStoredPart10(part10).getStoredDataset()) }
}

export function artifactOf(transferSyntaxes: readonly string[], pixelBytes = PIXEL_BYTES): StoredArtifact {
	const sopInstanceUid = Dataset.generateDerivedUid()
	return {
		sopClassUid: SECONDARY_CAPTURE_IMAGE_STORAGE,
		sopInstanceUid,
		variants: transferSyntaxes.map((transferSyntax) => variantOf(transferSyntax, sopInstanceUid, pixelBytes)),
	}
}

export function storedBytesOf(variant: StoredVariant | undefined): Buffer {
	return variant === undefined ? Buffer.alloc(0) : Dataset.fromStoredPart10(variant.part10).getStoredDataset()
}

export function studyQuery(extra: Partial<FindQuery> = {}): FindQuery {
	return {
		informationModel: INFORMATION_MODEL.STUDY_ROOT,
		identifier: { QueryRetrieveLevel: "STUDY", PatientID: SYNTHETIC_PATIENT_ID, StudyInstanceUID: "" },
		...extra,
	}
}

export function worklistQuery(extra: Partial<FindQuery> = {}): FindQuery {
	return {
		informationModel: INFORMATION_MODEL.MODALITY_WORKLIST,
		identifier: { PatientID: SYNTHETIC_PATIENT_ID, ScheduledProcedureStepSequence: [{ Modality: "" }] },
		...extra,
	}
}
