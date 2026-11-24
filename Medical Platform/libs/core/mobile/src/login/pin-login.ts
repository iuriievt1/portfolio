import type { MobileContract } from "@ansora/contracts"
import type { PinProofChallenge } from "../native"
import type { Session } from "./account-login"
import { pinProofChallenge } from "./pin"
import { type ChallengeApi, type LoginErrors, type QuickLoginOutcome, signInWithChallenge } from "./quick-login"

export type PinLoginRequest = MobileContract.components["schemas"]["PinLoginRequest"]

export interface PinLoginApi extends ChallengeApi {
	loginWithPin(request: PinLoginRequest): Promise<Session>
}

export interface PinProver {
	pinProof(personalNumber: string, pin: string, challenge: PinProofChallenge): Promise<string>
}

export interface PinLoginPorts extends LoginErrors {
	api: PinLoginApi
	prover: PinProver
}

export interface PinLoginRequestInput {
	personalNumber: string
	pin: string
}

export async function signInWithPin(ports: PinLoginPorts, request: PinLoginRequestInput): Promise<QuickLoginOutcome> {
	return await signInWithChallenge(ports.api, ports, {
		prove: (challenge) => ports.prover.pinProof(request.personalNumber, request.pin, pinProofChallenge(challenge)),
		login: (proof) => ports.api.loginWithPin({ personal_number: request.personalNumber, proof }),
	})
}
