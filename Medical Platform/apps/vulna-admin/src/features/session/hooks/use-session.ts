import { useCallback } from "react"
import { callApi } from "@/api/client"
import { endSession, useSessionEnded } from "@/features/session/session-store"
import type { AdministrationSession } from "@/features/session/types/session.types"
import { SESSION_CHECK_SECONDS, useLiveRefresh } from "@/lib/live-refresh"
import { useRequest } from "@/lib/use-request"

const SESSION_PATH = "/session"

// CAP-004-R11
export function useSession() {
	const load = useCallback(() => callApi<AdministrationSession>(SESSION_PATH), [])
	const request = useRequest(load)
	const ended = useSessionEnded()
	const { reload } = request

	useLiveRefresh(reload, SESSION_CHECK_SECONDS, !ended)

	const signOut = useCallback(async () => {
		await callApi<undefined>(SESSION_PATH, { method: "DELETE" })
		endSession()
	}, [])
	return { ...request, ended, signOut }
}
