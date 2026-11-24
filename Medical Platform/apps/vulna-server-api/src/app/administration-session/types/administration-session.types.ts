import type { Permission } from "@ansora/core-server"
import type { Request } from "express"
import type { AdministrationSessionEndReason } from "../constants/administration-session.constants"

export interface AdministrationSession {
	sessionId: string
	userId: string
	permissions: readonly Permission[]
}

export type AdministrationRequest = Request & { administrationSession?: AdministrationSession }

export interface AdministrationSessionRow {
	id: string
	user_id: string
	last_activity_at: Date
	confirmed_at: Date
	expires_at: Date
	ended_at: Date | null
	is_active: boolean
}

export interface NewAdministrationSession {
	userId: string
	tokenHash: string
	createdAt: Date
	expiresAt: Date
}

export interface IssuedAdministrationSession {
	sessionId: string
	token: string
	expiresAt: Date
}

export interface AdministrationSessionEnd {
	sessionId: string
	userId: string
	reason: AdministrationSessionEndReason
}

export interface AdministrationSessionTimes {
	idleExpiresAt: Date
	expiresAt: Date
}
