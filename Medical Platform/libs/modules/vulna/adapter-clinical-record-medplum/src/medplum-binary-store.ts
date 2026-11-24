import { Readable } from "node:stream"
import type {
	BinaryPlacement,
	DurableBinaryLinkPort,
	DurableBinaryRemovalPort,
	DurableBinaryStorePort,
} from "@ansora/core-server/ports"
import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain/ports"
import { MedplumClient } from "@medplum/core"
import { MISSING_STATUSES, SHA256_HEX, storedDigestOf } from "./binary-digest"
import { signedIn } from "./client-login"
import { failureOfResponse, HTTP_CREATED, storeErrorOf } from "./failure"
import { BINARY_REFERENCE } from "./file-resources"
import { type StorageSigning, signedLinkOf } from "./storage-link"
import { binaryTransferSignal, type Fetch, timedFetch } from "./timed-fetch"

export interface MedplumBinarySettings {
	baseUrl: string
	clientId: string
	clientSecret: string
	// ADR-053 (doplnění 2026-09-24) bod 1
	storageSigning?: StorageSigning
	fetch?: Fetch
}

const BINARY_RESOURCE = "Binary"
// backend.md 3.2
const SECURITY_CONTEXT_HEADER = "X-Security-Context"
const STREAMED_REQUEST = "half"
// backend.md 3.1 T8
const EXPUNGE_OPERATION = "$expunge"

interface CreatedBinary {
	id?: unknown
}

// CAP-021-R36, CAP-012-R30, ADR-050 bod 10, ADR-053 (doplnění 2026-09-24) bod 1, backend.md 3.2
export class MedplumBinaryStore implements DurableBinaryStorePort, DurableBinaryLinkPort, DurableBinaryRemovalPort {
	private readonly client: MedplumClient
	private readonly fetch: Fetch

	constructor(private readonly settings: MedplumBinarySettings) {
		this.fetch = timedFetch(settings.fetch ?? fetch)
		this.client = new MedplumClient({ baseUrl: settings.baseUrl, fetch: this.fetch })
	}

	// backend.md 3.2 U1–U7
	async upload(content: Readable, placement: BinaryPlacement): Promise<string> {
		const operation = `uploading a binary of ${placement.ownerReference}`
		try {
			await this.signIn()
			const response = await this.fetch(this.client.fhirUrl(BINARY_RESOURCE).toString(), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.client.getAccessToken()}`,
					"Content-Type": placement.contentType,
					[SECURITY_CONTEXT_HEADER]: placement.ownerReference,
				},
				body: Readable.toWeb(content),
				duplex: STREAMED_REQUEST,
				signal: binaryTransferSignal(),
			})
			if (response.status !== HTTP_CREATED) {
				throw await failureOfResponse(response, this.client, operation)
			}
			return binaryIdOf((await response.json()) as CreatedBinary, operation)
		} catch (error) {
			content.destroy()
			throw storeErrorOf(error, operation)
		}
	}

	// CAP-021-R36, CAP-021-S29
	async sha256Of(binaryId: string): Promise<string | undefined> {
		const operation = `reading back binary ${binaryId}`
		try {
			await this.signIn()
			return await storedDigestOf(this.client, binaryId, SHA256_HEX, operation)
		} catch (error) {
			throw storeErrorOf(error, operation)
		}
	}

	// CAP-026-R19, CAP-026-R20, dorucovaci-jadro.md 6, backend.md 3.1 T8, ADR-050 bod 14
	async removeWithVersions(binaryId: string): Promise<void> {
		const operation = `removing binary ${binaryId} with its versions`
		try {
			await this.signIn()
			const response = await this.fetch(this.client.fhirUrl(BINARY_RESOURCE, binaryId, EXPUNGE_OPERATION).toString(), {
				method: "POST",
				headers: { Authorization: `Bearer ${this.client.getAccessToken()}` },
			})
			if (!response.ok) {
				throw await failureOfResponse(response, this.client, operation)
			}
			await response.body?.cancel()
			if (await this.isStored(binaryId, operation)) {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, `${operation}: the binary is still stored`)
			}
		} catch (error) {
			throw storeErrorOf(error, operation)
		}
	}

	// CAP-020-R22, datovy-model.md 13.4
	async downloadLinkOf(binaryId: string, expiresAt: Date): Promise<string> {
		const operation = `signing a link to binary ${binaryId}`
		const signing = this.settings.storageSigning
		if (signing === undefined) {
			throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, `${operation}: no signing key`)
		}
		try {
			await this.signIn()
			return signedLinkOf(signing, { binaryId, projectId: this.projectId(operation), expiresAt })
		} catch (error) {
			throw storeErrorOf(error, operation)
		}
	}

	// dorucovaci-jadro.md 6
	private async isStored(binaryId: string, operation: string): Promise<boolean> {
		const response = await this.client.downloadResponse(`${BINARY_REFERENCE}${binaryId}`, {
			signal: binaryTransferSignal(),
		})
		if (MISSING_STATUSES.has(response.status)) {
			await response.body?.cancel()
			return false
		}
		if (!response.ok) {
			throw await failureOfResponse(response, this.client, operation)
		}
		await response.body?.cancel()
		return true
	}

	private async signIn(): Promise<void> {
		await signedIn(this.client, this.settings)
	}

	private projectId(operation: string): string {
		const project = this.client.getProject()
		if (project?.id === undefined) {
			throw new ClinicalRecordStoreError(
				CLINICAL_RECORD_FAILURE.UNAVAILABLE,
				`${operation}: the store returned no project`,
			)
		}
		return project.id
	}
}

// CAP-021-R27
function binaryIdOf(created: CreatedBinary, operation: string): string {
	if (typeof created.id !== "string" || created.id === "") {
		throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNKNOWN, `${operation}: the store answered no id`)
	}
	return created.id
}
