import { ERROR_CODE, type MobileContract } from "@ansora/contracts"

type DeviceState = MobileContract.components["schemas"]["DeviceState"]

export type DeviceTokenState = Pick<DeviceState, "device_token" | "device_token_expires_at">

export interface DeviceTokenApi {
	verifyDevice(): Promise<DeviceTokenState>
}

export interface DeviceTokenCaller {
	call<T>(work: (deviceToken: string) => Promise<T>): Promise<T>
}

export class NoDeviceTokenError extends Error {
	constructor() {
		super("The server issued no device token")
		this.name = "NoDeviceTokenError"
	}
}

// CAP-002-R09
const RENEWAL_MARGIN_MS = 60_000

interface HeldToken {
	token: string
	expiresAt: number
}

// CAP-002-R09, CAP-002-S24, CAP-019-S05
export function createDeviceTokenCaller(
	api: DeviceTokenApi,
	codeOf: (error: unknown) => string | undefined,
	now: () => number = Date.now,
): DeviceTokenCaller {
	let held: HeldToken | undefined
	let pending: Promise<string> | undefined

	async function issued(): Promise<string> {
		const state = await api.verifyDevice()
		const expiresAt = Date.parse(state.device_token_expires_at ?? "")
		if (state.device_token === undefined || Number.isNaN(expiresAt)) {
			held = undefined
			throw new NoDeviceTokenError()
		}
		held = { token: state.device_token, expiresAt }
		return state.device_token
	}

	async function validToken(): Promise<string> {
		if (held !== undefined && held.expiresAt - RENEWAL_MARGIN_MS > now()) {
			return held.token
		}
		pending ??= issued().finally(() => {
			pending = undefined
		})
		return await pending
	}

	return {
		async call<T>(work: (deviceToken: string) => Promise<T>): Promise<T> {
			const token = await validToken()
			try {
				return await work(token)
			} catch (error) {
				if (codeOf(error) !== ERROR_CODE.SIGN_IN_AGAIN) {
					throw error
				}
			}
			if (held?.token === token) {
				held = undefined
			}
			return await work(await validToken())
		},
	}
}
