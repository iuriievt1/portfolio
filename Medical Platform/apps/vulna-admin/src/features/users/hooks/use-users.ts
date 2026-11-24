import { useCallback } from "react"
import { callApi, withQuery } from "@/api/client"
import type { User, UsersPage } from "@/features/users/types/user.types"
import { useLiveRefresh } from "@/lib/live-refresh"
import { type CursorList, useCursorList } from "@/lib/use-cursor-list"
import { type RequestState, useRequest } from "@/lib/use-request"

const USERS_PATH = "/users"

// CAP-028-R14
export function useUsers(search: string | undefined): CursorList<User> {
	const loadPage = useCallback(
		(cursor: string | undefined, init?: RequestInit) =>
			callApi<UsersPage>(withQuery(USERS_PATH, { search, cursor }), init),
		[search],
	)
	const list = useCursorList(loadPage)
	useLiveRefresh(list.refresh)
	return list
}

export function useUserSearch(search: string | undefined, limit: number): RequestState<User[]> {
	const load = useCallback(async () => {
		if (search === undefined) {
			return []
		}
		const page = await callApi<UsersPage>(withQuery(USERS_PATH, { search, limit: String(limit) }))
		return page.items ?? []
	}, [search, limit])
	return useRequest(load)
}
