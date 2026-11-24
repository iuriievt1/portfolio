import { LATERALITY, type Laterality } from "@ansora/vulna-domain/ports"

export const SNOMED_CT = "http://snomed.info/sct"

// ADR-050, integrace-dicom.md 5.9
export const LATERALITY_SNOMED: Record<Laterality, string> = {
	[LATERALITY.RIGHT]: "24028007",
	[LATERALITY.LEFT]: "7771000",
}
