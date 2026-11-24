import { createHash } from "node:crypto"
import { type DicomInstance, isUid } from "@ansora/vulna-domain"
import { data } from "@veevoy/dcmjs"
import { bytesElement, type DicomElements, textElement } from "./elements"
import { TAG } from "./tags"
import type { TransferSyntax } from "./transfer-syntax"

// integrace-dicom.md 5.0, 6.1, dorucovaci-jadro.md 3, ADR-005 ř. 22, 23, CAP-021-R06, CAP-023-R15
export interface ArtifactVariant {
	transferSyntaxUid: TransferSyntax
	part10: Buffer
	datasetSha256: string
}

// integrace-dicom.md 4, 5.0, CAP-012-R17, CAP-021-R12, Q-045
export interface ImplementationIdentity {
	implementationClassUid: string
	implementationVersionName: string | undefined
}

// DICOM PS3.10 7.1
const PREAMBLE_BYTES = 128
const PREFIX = "DICM"
const GROUP_LENGTH_ELEMENT = Buffer.from([0x02, 0x00, 0x00, 0x00, 0x55, 0x4c, 0x04, 0x00])
const GROUP_LENGTH_VALUE_OFFSET = PREAMBLE_BYTES + PREFIX.length + GROUP_LENGTH_ELEMENT.length
const GROUP_LENGTH_VALUE_BYTES = 4
const FILE_META_INFORMATION_VERSION = Uint8Array.from([0x00, 0x01])
// DICOM PS3.10 7.1
const IMPLEMENTATION_VERSION_NAME = /^(?=.*[^ ])[\x20-\x5b\x5d-\x7e]{1,16}$/
// integrace-dicom.md 3.1, ADR-017
const WRITE_OPTIONS = { allowInvalidVRLength: false, fragmentMultiframe: false }

// DICOM PS3.10 7.1, integrace-dicom.md 5.0
export function isImplementationVersionName(value: string): boolean {
	return IMPLEMENTATION_VERSION_NAME.test(value)
}

// DICOM PS3.10 7.1, integrace-dicom.md 5.0, ADR-017
export function part10Of(
	instance: DicomInstance,
	transferSyntaxUid: TransferSyntax,
	identity: ImplementationIdentity,
	dataset: DicomElements,
): ArtifactVariant {
	const file = new data.DicomDict(fileMetaOf(instance, transferSyntaxUid, identity))
	file.dict = dataset
	const part10 = Buffer.from(file.write(WRITE_OPTIONS))
	return {
		transferSyntaxUid,
		part10,
		datasetSha256: createHash("sha256")
			.update(part10.subarray(datasetOffsetOf(part10)))
			.digest("hex"),
	}
}

// integrace-dicom.md 5.0, CAP-012-R17
function fileMetaOf(
	instance: DicomInstance,
	transferSyntaxUid: TransferSyntax,
	identity: ImplementationIdentity,
): DicomElements {
	const { implementationClassUid, implementationVersionName } = identity
	if (!isUid(implementationClassUid)) {
		throw new Error("the Implementation Class UID in the configuration is not a DICOM UID")
	}
	if (implementationVersionName !== undefined && !isImplementationVersionName(implementationVersionName)) {
		throw new Error("the Implementation Version Name in the configuration is not 1 to 16 ISO 646 characters")
	}
	return {
		[TAG.FILE_META_INFORMATION_VERSION]: bytesElement(FILE_META_INFORMATION_VERSION),
		[TAG.MEDIA_STORAGE_SOP_CLASS_UID]: textElement("UI", instance.sopClassUid),
		[TAG.MEDIA_STORAGE_SOP_INSTANCE_UID]: textElement("UI", instance.sopInstanceUid),
		[TAG.TRANSFER_SYNTAX_UID]: textElement("UI", transferSyntaxUid),
		[TAG.IMPLEMENTATION_CLASS_UID]: textElement("UI", implementationClassUid),
		...(implementationVersionName === undefined
			? {}
			: { [TAG.IMPLEMENTATION_VERSION_NAME]: textElement("SH", implementationVersionName) }),
	}
}

// DICOM PS3.10 7.1, integrace-dicom.md 6.1
function datasetOffsetOf(part10: Buffer): number {
	const hasPrefix = part10.toString("latin1", PREAMBLE_BYTES, PREAMBLE_BYTES + PREFIX.length) === PREFIX
	const groupLength = part10.subarray(PREAMBLE_BYTES + PREFIX.length, GROUP_LENGTH_VALUE_OFFSET)
	const hasGroupLength = hasPrefix && groupLength.equals(GROUP_LENGTH_ELEMENT)
	if (!hasGroupLength) {
		throw new Error("the DICOM library wrote no file meta information group length")
	}
	return GROUP_LENGTH_VALUE_OFFSET + GROUP_LENGTH_VALUE_BYTES + part10.readUInt32LE(GROUP_LENGTH_VALUE_OFFSET)
}
