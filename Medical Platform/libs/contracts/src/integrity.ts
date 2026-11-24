import type { components } from "./generated/mobile"

export type IntegrityReport = components["schemas"]["IntegrityReport"]

export type IntegritySignal = IntegrityReport["signals"][number]

// CAP-008-R02, identity.yaml IntegrityReport
export const INTEGRITY_SIGNAL = {
	JAILBREAK: "jailbreak",
	ROOT: "root",
	MAGISK: "magisk",
	FRIDA: "frida",
	DEBUGGER: "debugger",
	EMULATOR: "emulator",
	APP_INTEGRITY: "app_integrity",
} as const satisfies { readonly [Signal in IntegritySignal as Uppercase<Signal>]: Signal }

export const INTEGRITY_SIGNALS: readonly IntegritySignal[] = Object.values(INTEGRITY_SIGNAL)
