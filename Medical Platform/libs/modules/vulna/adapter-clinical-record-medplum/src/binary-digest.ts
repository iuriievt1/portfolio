import { createHash } from "node:crypto"
import type { MedplumClient } from "@medplum/core"
import { failureOfResponse, HTTP_GONE, HTTP_NOT_FOUND } from "./failure"
import { BINARY_REFERENCE } from "./file-resources"
import { binaryTransferSignal } from "./timed-fetch"

interface Digest {
	algorithm: string
	encoding: "hex" | "base64"
}

// CAP-021-R36, datovy-model.md 4 binary_object.sha256
export const SHA256_HEX: Digest = { algorithm: "sha256", encoding: "hex" }
// CAP-021-R37, ADR-050 bod 13
export const SHA1_BASE64: Digest = { algorithm: "sha1", encoding: "base64" }
// CAP-021-S29
export const MISSING_STATUSES: ReadonlySet<number> = new Set([HTTP_NOT_FOUND, HTTP_GONE])

export async function digestOf(response: Response, digest: Digest): Promise<string> {
	const hash = createHash(digest.algorithm)
	if (response.body !== null) {
		for await (const chunk of response.body) {
			hash.update(chunk)
		}
	}
	return hash.digest(digest.encoding)
}

// CAP-021-R36, CAP-021-R37, ADR-050 bod 11
export async function storedDigestOf(
	client: MedplumClient,
	binaryId: string,
	digest: Digest,
	operation: string,
): Promise<string | undefined> {
	const response = await client.downloadResponse(`${BINARY_REFERENCE}${binaryId}`, { signal: binaryTransferSignal() })
	if (MISSING_STATUSES.has(response.status)) {
		await response.body?.cancel()
		return undefined
	}
	if (!response.ok) {
		throw await failureOfResponse(response, client, operation)
	}
	return await digestOf(response, digest)
}
