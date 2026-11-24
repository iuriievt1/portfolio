import { useCallback } from "react"
import { callApi } from "@/api/client"
import type {
	Card,
	CardBindingCode,
	QrCode,
	User,
	UserDepartmentRequest,
	UserRolesRequest,
} from "@/features/users/types/user.types"
import { useRequest } from "@/lib/use-request"

function userPath(userId: string): string {
	return `/users/${encodeURIComponent(userId)}`
}

function revocationPath(collection: string, id: string): string {
	return `/${collection}/${encodeURIComponent(id)}/revocation`
}

export function useUser(userId: string) {
	const loadUser = useCallback(() => callApi<User>(userPath(userId)), [userId])
	const loadCards = useCallback(() => callApi<Card[]>(`${userPath(userId)}/cards`), [userId])
	return { user: useRequest(loadUser), cards: useRequest(loadCards) }
}

export function useQrCodes(userId: string) {
	const loadQrCodes = useCallback(() => callApi<QrCode[]>(`${userPath(userId)}/qr-codes`), [userId])
	return useRequest(loadQrCodes)
}

export function issueCardBinding(userId: string): Promise<CardBindingCode> {
	return callApi<CardBindingCode>(`${userPath(userId)}/cards`, { method: "POST" })
}

export function issueQrCode(userId: string): Promise<QrCode> {
	return callApi<QrCode>(`${userPath(userId)}/qr-codes`, { method: "POST" })
}

// CAP-003-R03
export function setUserRoles(userId: string, request: UserRolesRequest): Promise<User> {
	return callApi<User>(`${userPath(userId)}/roles`, { method: "PUT", body: JSON.stringify(request) })
}

// CAP-003-R07
export function setUserDepartment(userId: string, request: UserDepartmentRequest): Promise<User> {
	return callApi<User>(`${userPath(userId)}/department`, { method: "PUT", body: JSON.stringify(request) })
}

// CAP-005-R07, CAP-005-R12
export function revokeUser(userId: string): Promise<void> {
	return callApi<void>(`${userPath(userId)}/revocation`, { method: "POST" })
}

// CAP-005-R03
export function revokeCard(cardId: string): Promise<void> {
	return callApi<void>(revocationPath("cards", cardId), { method: "POST" })
}

// CAP-005-R05
export function revokeQrCode(qrCodeId: string): Promise<void> {
	return callApi<void>(revocationPath("qr-codes", qrCodeId), { method: "POST" })
}
