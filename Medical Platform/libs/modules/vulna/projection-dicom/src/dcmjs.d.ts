// ADR-017
declare module "@veevoy/dcmjs" {
	// DICOM PS3.18 F.2
	export interface DicomElement {
		vr: string
		Value: unknown[]
	}

	export type DicomElements = Record<string, DicomElement>

	interface DicomWriteOptions {
		allowInvalidVRLength?: boolean
		fragmentMultiframe?: boolean
	}

	class DicomDict {
		constructor(meta: DicomElements)
		dict: DicomElements
		write(writeOptions?: DicomWriteOptions): ArrayBuffer
	}

	// DICOM PS3.10 7
	interface DicomReadOptions {
		ignoreErrors?: boolean
		untilTag?: string | null
		includeUntilTagValue?: boolean
		noCopy?: boolean
		forceStoreRaw?: boolean
	}

	interface DicomMessage {
		readFile(buffer: ArrayBuffer, options?: DicomReadOptions): DicomDict
	}

	export const data: {
		DicomDict: typeof DicomDict
		DicomMessage: DicomMessage
	}
}
