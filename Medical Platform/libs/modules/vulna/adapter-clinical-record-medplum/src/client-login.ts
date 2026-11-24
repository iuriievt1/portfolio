import { CLINICAL_RECORD_FAILURE, ClinicalRecordStoreError } from "@ansora/vulna-domain/ports"
import type { MedplumClient } from "@medplum/core"

export interface ClientCredential {
	clientId: string
	clientSecret: string
}

// CAP-012-R30, ADR-054 bod 3
export async function signedIn(client: MedplumClient, credential: ClientCredential): Promise<void> {
	if (client.isAuthenticated()) {
		return
	}
	try {
		await client.startClientLogin(credential.clientId, credential.clientSecret)
	} catch (error) {
		throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, `signing in to the store: ${String(error)}`)
	}
}
