import type { JwsSigner } from "../device/device-proof"
import type { Session } from "./account-login"
import { carrierBody } from "./carrier-body"
import { type ChallengeApi, type LoginErrors, type QuickLoginOutcome, signInWithChallenge } from "./quick-login"

export interface BarcodeLoginApi extends ChallengeApi {
	loginWithBarcode(signedBody: string): Promise<Session>
}

export interface BarcodeLoginPorts extends LoginErrors {
	api: BarcodeLoginApi
	signer: Pick<JwsSigner, "signJws">
}

// identity.yaml loginWithBarcode
export async function signInWithBarcode(ports: BarcodeLoginPorts, content: string): Promise<QuickLoginOutcome> {
	return await signInWithChallenge(ports.api, ports, {
		prove: (challenge) => carrierBody(ports.signer, challenge, content),
		login: (signedBody) => ports.api.loginWithBarcode(signedBody),
	})
}
