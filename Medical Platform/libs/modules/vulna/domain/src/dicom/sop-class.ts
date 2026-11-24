// DICOM PS3.6 A, integrace-dicom.md 2, CAP-021-R09, CAP-021-R10
export const SOP_CLASS = {
	VL_PHOTOGRAPHIC_IMAGE: "1.2.840.10008.5.1.4.1.1.77.1.4",
	ENCAPSULATED_PDF: "1.2.840.10008.5.1.4.1.1.104.1",
} as const

export type SopClass = (typeof SOP_CLASS)[keyof typeof SOP_CLASS]
