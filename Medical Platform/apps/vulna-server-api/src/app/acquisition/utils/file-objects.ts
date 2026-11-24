import type { StoredBinaryObject } from "../../binary-object/types/binary-object.types"
import type { AcquisitionFileRow, StoredContent } from "../types/acquisition-file.types"

// CAP-026-R17, datovy-model.md 4 Binární objekt
export function binaryObjectIdsOf(file: AcquisitionFileRow): string[] {
	return [file.binary_object_id, file.thumbnail_binary_object_id].flatMap((id) => (id === null ? [] : [id]))
}

// CAP-021-R35, CAP-026-R14
export function storedObjectsOf(content: StoredContent): StoredBinaryObject[] {
	return content.thumbnail === undefined ? [content.file] : [content.file, content.thumbnail]
}
