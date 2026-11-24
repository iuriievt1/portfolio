import { type LocalizedNames, nameIn } from "@ansora/contracts"
import { type DicomCommonObject, type DicomCommonSource, dicomCommonOf } from "./dicom-object"
import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"
import { MODALITY } from "./series"
import { SOP_CLASS } from "./sop-class"
import { SHORT_TEXT_MAX_LENGTH, textValueOf } from "./value-representation"

// integrace-dicom.md 5.6
export interface DicomScannedDocument {
	documentTitle: string
	mimeType: string
	conversionType: string
	burnedInAnnotation: string
	bytes: Uint8Array
}

// integrace-dicom.md 2, 5, CAP-021-R10
export interface DicomDocumentObject extends DicomCommonObject {
	document: DicomScannedDocument
}

// integrace-dicom.md 5.6, CAP-018-R15
export type DicomDocumentTitleSource = { names: LocalizedNames } | { text: string }

// integrace-dicom.md 5, CAP-021-R10, CAP-022-R05
export interface DicomDocumentSource extends DicomCommonSource {
	title: DicomDocumentTitleSource
	pdf: Uint8Array
}

// integrace-dicom.md 5.6
const PDF_MIME_TYPE = "application/pdf"
const SCANNED_DOCUMENT = "SD"
const PATIENT_DATA_BURNED_IN = "YES"
// ISO 32000-2 7.5.2
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]

// integrace-dicom.md 2, 5, CAP-021-R10, CAP-021-R26
export function dicomDocumentObjectOf(source: DicomDocumentSource): DicomDocumentObject {
	if (!PDF_HEADER.every((byte, index) => source.pdf[index] === byte)) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.UNSUPPORTED_DOCUMENT, "the document is not a PDF")
	}
	return {
		...dicomCommonOf(source, MODALITY.DOCUMENT, SOP_CLASS.ENCAPSULATED_PDF),
		document: {
			documentTitle: dicomDocumentTitleOf(source.title, source.assembly.language),
			mimeType: PDF_MIME_TYPE,
			conversionType: SCANNED_DOCUMENT,
			burnedInAnnotation: PATIENT_DATA_BURNED_IN,
			bytes: source.pdf,
		},
	}
}

// integrace-dicom.md 5.6, 5.8, CAP-018-R15, CAP-021-R26
export function dicomDocumentTitleOf(title: DicomDocumentTitleSource, language: string): string {
	const documentTitle = "text" in title ? title.text : nameIn(title.names, language)
	if (documentTitle === undefined) {
		throw new DicomMappingError(
			DICOM_MAPPING_FAILURE.UNSUPPORTED_LANGUAGE,
			`a document title is missing in ${language}`,
		)
	}
	return textValueOf("Document Title", documentTitle, SHORT_TEXT_MAX_LENGTH)
}
