import { ERROR_CODE, type MobileContract } from "@ansora/contracts"
import type { Session } from "../login/account-login"

export type SessionRefreshRequest = MobileContract.components["schemas"]["SessionRefreshRequest"]

const USER_SCOPE: SessionRefreshRequest["scope"] = "user"

export interface SessionRefreshApi {
	refreshSession(sessionToken: string, request: SessionRefreshRequest): Promise<Session>
}

export interface SessionHolder {
	current(): Session | undefined
	renewed(session: Session): void
	ended(): Promise<void>
}

export interface SessionCaller {
	call<T>(work: (sessionToken: string) => Promise<T>): Promise<T>
}

export class NoSessionError extends Error {
	constructor() {
		super("The app holds no session")
		this.name = "NoSessionError"
	}
}

// CAP-002-R01, CAP-002-R21
export function createSessionCaller(
	api: SessionRefreshApi,
	holder: SessionHolder,
	codeOf: (error: unknown) => string | undefined,
): SessionCaller {
	let pending: Promise<void> | undefined

	async function refresh(session: Session): Promise<void> {
		try {
			const request = { scope: USER_SCOPE, session_id: session.session_id }
			holder.renewed(await api.refreshSession(session.session_token, request))
		} catch (error) {
			if (codeOf(error) === ERROR_CODE.SIGN_IN_AGAIN) {
				await holder.ended()
			}
			throw error
		}
	}

	async function renewedAfter(used: Session): Promise<Session> {
		const latest = activeSession()
		if (latest.session_token !== used.session_token) {
			return latest
		}
		pending ??= refresh(latest).finally(() => {
			pending = undefined
		})
		await pending
		return activeSession()
	}

	function activeSession(): Session {
		const session = holder.current()
		if (session === undefined) {
			throw new NoSessionError()
		}
		return session
	}

	return {
		async call<T>(work: (sessionToken: string) => Promise<T>): Promise<T> {
			const session = activeSession()
			try {
				return await work(session.session_token)
			} catch (error) {
				if (codeOf(error) !== ERROR_CODE.SIGN_IN_AGAIN) {
					throw error
				}
			}
			const renewed = await renewedAfter(session)
			return await work(renewed.session_token)
		},
	}
}
