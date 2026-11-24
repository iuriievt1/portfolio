import type { JwsSigner } from "../device/device-proof"
import type { Session } from "./account-login"
import { carrierBody } from "./carrier-body"
import { type ChallengeApi, type LoginErrors, type QuickLoginOutcome, signInWithChallenge } from "./quick-login"

export interface QrCodeLoginApi extends ChallengeApi {
	loginWithQrCode(signedBody: string): Promise<Session>
}

export interface QrCodeLoginPorts extends LoginErrors {
	api: QrCodeLoginApi
	signer: Pick<JwsSigner, "signJws">
}

export async function signInWithQrCode(ports: QrCodeLoginPorts, content: string): Promise<QuickLoginOutcome> {
	return await signInWithChallenge(ports.api, ports, {
		prove: (challenge) => carrierBody(ports.signer, challenge, content),
		login: (signedBody) => ports.api.loginWithQrCode(signedBody),
	})
}
