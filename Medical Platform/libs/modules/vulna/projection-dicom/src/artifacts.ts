import type { DicomDocumentObject, DicomImageObject, DicomInstance } from "@ansora/vulna-domain"
import { documentElementsOf, imageElementsOf } from "./datasets"
import type { DicomElements } from "./elements"
import { type ArtifactVariant, type ImplementationIdentity, part10Of } from "./part10"
import { TRANSFER_SYNTAX, type TransferSyntax } from "./transfer-syntax"

// integrace-dicom.md 3, CAP-021-R17, Q-043
export const IMAGE_TRANSFER_SYNTAXES: readonly TransferSyntax[] = [TRANSFER_SYNTAX.JPEG_BASELINE]
export const DOCUMENT_TRANSFER_SYNTAXES: readonly TransferSyntax[] = [
	TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN,
	TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN,
]
// DICOM PS3.5 7.1.1, A.4
const MAX_VALUE_LENGTH = 0xff_ff_ff_fe

interface ArtifactContent {
	source: string
	instance: DicomInstance
	bytes: Uint8Array
	dataset: DicomElements
	supported: readonly TransferSyntax[]
}

// integrace-dicom.md 2, 3, 3.1, 5.5, CAP-021-R06, CAP-021-R07, CAP-021-R09, CAP-021-R17
export function imageArtifactOf(
	object: DicomImageObject,
	transferSyntaxes: readonly TransferSyntax[],
	identity: ImplementationIdentity,
): ArtifactVariant[] {
	const content = {
		source: "an image",
		instance: object.instance,
		bytes: object.stream.bytes,
		dataset: imageElementsOf(object),
		supported: IMAGE_TRANSFER_SYNTAXES,
	}
	return artifactOf(content, transferSyntaxes, identity)
}

// integrace-dicom.md 2, 3, 5.6, CAP-021-R06, CAP-021-R10, CAP-021-R17, CAP-022-R07
export function documentArtifactOf(
	object: DicomDocumentObject,
	transferSyntaxes: readonly TransferSyntax[],
	identity: ImplementationIdentity,
): ArtifactVariant[] {
	const content = {
		source: "a document",
		instance: object.instance,
		bytes: object.document.bytes,
		dataset: documentElementsOf(object),
		supported: DOCUMENT_TRANSFER_SYNTAXES,
	}
	return artifactOf(content, transferSyntaxes, identity)
}

// integrace-dicom.md 3, dorucovaci-jadro.md 3, CAP-023-R15
function artifactOf(
	content: ArtifactContent,
	transferSyntaxes: readonly TransferSyntax[],
	identity: ImplementationIdentity,
): ArtifactVariant[] {
	const { source, instance, bytes, dataset, supported } = content
	if (transferSyntaxes.length === 0 || new Set(transferSyntaxes).size !== transferSyntaxes.length) {
		throw new Error(`${source} needs distinct transfer syntaxes from the configuration`)
	}
	const unsupported = transferSyntaxes.find((transferSyntax) => !supported.includes(transferSyntax))
	if (unsupported !== undefined) {
		throw new Error(`${source} is not built in the transfer syntax ${unsupported}`)
	}
	if (bytes.length + (bytes.length % 2) > MAX_VALUE_LENGTH) {
		throw new Error(`${source} does not fit one DICOM value`)
	}
	return transferSyntaxes.map((transferSyntax) => part10Of(instance, transferSyntax, identity, dataset))
}
