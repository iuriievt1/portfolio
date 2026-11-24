import { requireNativeModule } from "expo"
import type { OsIntegrity, OsIntegrityEvents } from "./index"
import type { EventEmittingModule } from "./native-module"

const MODULE_NAME = "OsIntegrity"

export const OS_INTEGRITY_EVENT = {
	DETECTED: "detected",
} as const satisfies Record<string, keyof OsIntegrityEvents>

export type OsIntegrityModule = EventEmittingModule<OsIntegrity, OsIntegrityEvents>

// mobilni-aplikace.md 2, NAB-144, NAB-454
export function osIntegrity(): OsIntegrityModule {
	return requireNativeModule<OsIntegrityModule>(MODULE_NAME)
}
