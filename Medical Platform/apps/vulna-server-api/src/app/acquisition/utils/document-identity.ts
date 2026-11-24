import { nameBasedUuid } from "../../../libs/common/utils/name-based-uuid"

// CAP-021-R29, CAP-021-R39, ADR-050 bod 10
const DOCUMENT_ID_NAMESPACE = "1811fa24-77ab-4ead-86b1-4b2b6298bd8e"
// CAP-021-R28, CAP-021-R39, ADR-050 bod 10
const DOCUMENT_SERIES_ID_NAMESPACE = "7b317e5d-5cad-4ef3-8fde-3a6fb05486d6"

// RFC 9562 version 5
export function documentIdOfDraft(idempotencyKey: string): string {
	return nameBasedUuid(DOCUMENT_ID_NAMESPACE, idempotencyKey.toLowerCase())
}

// CAP-014-R25, ADR-050 (doplnění D33) bod 3
export function documentIdOfMove(idempotencyKey: string, encounterId: string): string {
	return nameBasedUuid(DOCUMENT_ID_NAMESPACE, `${idempotencyKey.toLowerCase()}:${encounterId.toLowerCase()}`)
}

// CAP-021-R28, CAP-021-R39
export function seriesIdOfDocument(documentId: string): string {
	return nameBasedUuid(DOCUMENT_SERIES_ID_NAMESPACE, documentId.toLowerCase())
}
