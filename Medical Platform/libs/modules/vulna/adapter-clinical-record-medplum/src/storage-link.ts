import { createSign } from "node:crypto"
import { withoutTrailingSlash } from "./identifiers"

// ADR-053 (doplnění 2026-09-24) bod 1, datovy-model.md 13.4
export interface StorageSigning {
	storageUrl: string
	signingKey: string
	signingKeyPassphrase: string
}

export interface StorageLink {
	binaryId: string
	projectId: string
	expiresAt: Date
}

// Medplum 5.2.18 storage/presign.ts
const SIGNED_METHOD = "GET"
const SIGNATURE_ALGORITHM = "sha256"
const SIGNATURE_ENCODING = "base64"
const EXPIRES_PARAMETER = "Expires"
const PROJECT_PARAMETER = "Project"
const SIGNATURE_PARAMETER = "Signature"
const MILLISECONDS_PER_SECOND = 1000

// CAP-020-R22, CAP-011-R02, ADR-053 (doplnění 2026-09-24) bod 1
export function signedLinkOf(signing: StorageSigning, link: StorageLink): string {
	const url = new URL(`${withoutTrailingSlash(signing.storageUrl)}/${encodeURIComponent(link.binaryId)}`)
	url.searchParams.set(EXPIRES_PARAMETER, String(Math.floor(link.expiresAt.getTime() / MILLISECONDS_PER_SECOND)))
	url.searchParams.set(PROJECT_PARAMETER, link.projectId)
	const signature = createSign(SIGNATURE_ALGORITHM)
		.update(`${SIGNED_METHOD} ${url.toString()}`)
		.sign({ key: signing.signingKey, passphrase: signing.signingKeyPassphrase }, SIGNATURE_ENCODING)
	url.searchParams.set(SIGNATURE_PARAMETER, signature)
	return url.toString()
}
