import { createHash } from "node:crypto"

// FHIR R4 Attachment.hash
const ATTACHMENT_HASH_ALGORITHM = "sha1"
const ATTACHMENT_HASH_ENCODING = "base64"

// CAP-021-R37, FHIR R4 Attachment.hash
export function attachmentHashOf(bytes: Buffer): string {
	return createHash(ATTACHMENT_HASH_ALGORITHM).update(bytes).digest(ATTACHMENT_HASH_ENCODING)
}
