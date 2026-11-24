import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { CodedError, codeOf } from "../../__tests__/coded-error"
import { epochSeconds } from "../../device/device-proof"
import { bindCard, type CardBindingPorts, type CardBindingReceipt } from "../card-binding"

const NOW = new Date("2026-10-01T10:00:00.000Z")
const BINDING = { identifier: "04A1B2C3D4E5F6", bindingCode: "K7M2Q9X4H3TZ" }
const RECEIPT: CardBindingReceipt = {
	card_id: "8c0d4a52-6a43-4f55-9a43-3c2f8d5c1e10",
	short_uid: "…E5F6",
	user_display_name: "Jana Nováková",
	bound_at: "2026-10-01T10:00:01.000Z",
}

function fakes(complete: (attempt: number) => Promise<CardBindingReceipt>) {
	const payloads: unknown[] = []
	let challenges = 0
	let attempts = 0
	const ports: CardBindingPorts = {
		api: {
			async issueChallenge() {
				challenges += 1
				return { challenge_id: `c${challenges}`, value: "v", expires_at: "2026-10-01T10:02:00.000Z" }
			},
			async completeCardBinding() {
				attempts += 1
				return await complete(attempts)
			},
		},
		signer: {
			async signJws(_header, payload) {
				payloads.push(JSON.parse(payload))
				return "jws"
			},
		},
		codeOf,
	}
	return { ports, payloads }
}

describe("bindCard", () => {
	it("CAP-005-S01 signs the read card with the binding code and returns the receipt", async () => {
		const { ports, payloads } = fakes(async () => RECEIPT)

		expect(await bindCard(ports, BINDING, () => NOW)).toEqual(RECEIPT)
		expect(payloads).toEqual([
			{
				challenge_id: "c1",
				value: "v",
				iat: epochSeconds(NOW),
				identifier: BINDING.identifier,
				binding_code: BINDING.bindingCode,
			},
		])
	})

	it("asks for a fresh challenge once when the first one is spent", async () => {
		const { ports, payloads } = fakes(async (attempt) => {
			if (attempt === 1) {
				throw new CodedError(ERROR_CODE.CHALLENGE_INVALID)
			}
			return RECEIPT
		})

		expect(await bindCard(ports, BINDING, () => NOW)).toEqual(RECEIPT)
		expect(payloads.map((payload) => (payload as { challenge_id: string }).challenge_id)).toEqual(["c1", "c2"])
	})

	it("CAP-005-S12 passes a spent code on without trying again", async () => {
		const { ports, payloads } = fakes(async () => {
			throw new CodedError(ERROR_CODE.CARD_BINDING_CODE_INVALID)
		})

		await expect(bindCard(ports, BINDING, () => NOW)).rejects.toMatchObject({
			code: ERROR_CODE.CARD_BINDING_CODE_INVALID,
		})
		expect(payloads).toHaveLength(1)
	})
})
