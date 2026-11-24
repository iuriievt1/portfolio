import { createHash } from "node:crypto"
import { Dataset } from "@veevoy/dcmjs-dimse"
import type { StoredArtifact } from "./contract"

// PS3.6 (0008,0016), (0008,0018)
const SOP_CLASS_UID = "SOPClassUID"
const SOP_INSTANCE_UID = "SOPInstanceUID"

// integrace-dicom.md 6.1, 8.1, CAP-023-R09, CAP-023-S19, ADR-005 ř. 22, 23
export function storedVariantsOf(artifact: StoredArtifact): Dataset[] | undefined {
	if (artifact.variants.length === 0) {
		return undefined
	}
	const variants: Dataset[] = []
	for (const variant of artifact.variants) {
		let dataset: Dataset
		try {
			dataset = Dataset.fromStoredPart10(variant.part10)
		} catch {
			return undefined
		}
		const datasetSha256 = createHash("sha256").update(dataset.getStoredDataset()).digest("hex")
		if (
			datasetSha256 !== variant.datasetSha256.toLowerCase() ||
			dataset.getTransferSyntaxUid() !== variant.transferSyntaxUid ||
			dataset.getElement(SOP_CLASS_UID) !== artifact.sopClassUid ||
			dataset.getElement(SOP_INSTANCE_UID) !== artifact.sopInstanceUid
		) {
			return undefined
		}
		variants.push(dataset)
	}
	const transferSyntaxes = new Set(artifact.variants.map((variant) => variant.transferSyntaxUid))
	return transferSyntaxes.size === variants.length ? variants : undefined
}
