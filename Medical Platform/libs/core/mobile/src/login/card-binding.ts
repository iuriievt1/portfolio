import { ERROR_CODE, type MobileContract } from "@ansora/contracts"
import { type JwsSigner, signBody } from "../device/device-proof"
import { challengeClaims } from "./carrier-body"
import type { ChallengeApi, LoginErrors } from "./quick-login"

export type CardBindingReceipt = MobileContract.components["schemas"]["CardBindingReceipt"]

export interface CardBindingApi extends ChallengeApi {
	completeCardBinding(signedBody: string): Promise<CardBindingReceipt>
}

export interface CardBindingPorts extends Pick<LoginErrors, "codeOf"> {
	api: CardBindingApi
	signer: Pick<JwsSigner, "signJws">
}

export interface CardBinding {
	identifier: string
	bindingCode: string
}

export async function bindCard(
	ports: CardBindingPorts,
	binding: CardBinding,
	now: () => Date = () => new Date(),
): Promise<CardBindingReceipt> {
	try {
		return await completeBinding(ports, binding, now)
	} catch (error) {
		if (ports.codeOf(error) !== ERROR_CODE.CHALLENGE_INVALID) {
			throw error
		}
		return await completeBinding(ports, binding, now)
	}
}

async function completeBinding(
	ports: CardBindingPorts,
	binding: CardBinding,
	now: () => Date,
): Promise<CardBindingReceipt> {
	const challenge = await ports.api.issueChallenge()
	const signedBody = await signBody(ports.signer, {
		...challengeClaims(challenge, now()),
		identifier: binding.identifier,
		binding_code: binding.bindingCode,
	})
	return await ports.api.completeCardBinding(signedBody)
}
