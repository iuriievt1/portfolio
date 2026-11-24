import type { MobileContract } from "@ansora/contracts"
import type { Session, SessionRefreshApi, SessionRefreshRequest, SessionTerminationApi } from "@ansora/core-mobile"
import { callApi } from "./client"

const REFRESH_PATH: keyof MobileContract.paths = "/session/refresh"
const TERMINATION_PATH: keyof MobileContract.paths = "/session/termination"

export const sessionApi: SessionRefreshApi & SessionTerminationApi = {
	refreshSession: (sessionToken: string, request: SessionRefreshRequest): Promise<Session> =>
		callApi<Session>(REFRESH_PATH, { method: "POST", sessionToken, body: request }),
	terminateSession: (sessionToken: string): Promise<void> =>
		callApi<void>(TERMINATION_PATH, { method: "POST", sessionToken }),
}
