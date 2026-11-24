// DICOM PS3.6 A, integrace-dicom.md 3, CAP-021-R17
export const TRANSFER_SYNTAX = {
	JPEG_BASELINE: "1.2.840.10008.1.2.4.50",
	EXPLICIT_VR_LITTLE_ENDIAN: "1.2.840.10008.1.2.1",
	IMPLICIT_VR_LITTLE_ENDIAN: "1.2.840.10008.1.2",
} as const

export type TransferSyntax = (typeof TRANSFER_SYNTAX)[keyof typeof TRANSFER_SYNTAX]
