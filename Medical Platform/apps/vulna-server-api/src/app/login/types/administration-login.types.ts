import type { AdministrationContract } from "@ansora/contracts"

export type AdministrationSessionView = AdministrationContract.components["schemas"]["AdministrationSession"]

export interface NewAdministrationLoginFlow {
	state: string
	codeVerifier: string
	nonce: string
	startedAt: Date
	expiresAt: Date
}

export interface AdministrationLoginFlowRow {
	code_verifier: string
	nonce: string
	started_at: Date
}
