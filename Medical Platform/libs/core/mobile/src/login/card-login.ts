import type { JwsSigner } from "../device/device-proof"
import type { Session } from "./account-login"
import { carrierBody } from "./carrier-body"
import { type ChallengeApi, type LoginErrors, type QuickLoginOutcome, signInWithChallenge } from "./quick-login"

const NON_HEX = /[^0-9a-f]/gi

export interface CardLoginApi extends ChallengeApi {
	loginWithCard(signedBody: string): Promise<Session>
}

export interface CardLoginPorts extends LoginErrors {
	api: CardLoginApi
	signer: Pick<JwsSigner, "signJws">
}

export function cardIdentifierOf(tagId: string): string {
	return tagId.replace(NON_HEX, "").toUpperCase()
}

export async function signInWithCard(ports: CardLoginPorts, identifier: string): Promise<QuickLoginOutcome> {
	return await signInWithChallenge(ports.api, ports, {
		prove: (challenge) => carrierBody(ports.signer, challenge, identifier),
		login: (signedBody) => ports.api.loginWithCard(signedBody),
	})
}
