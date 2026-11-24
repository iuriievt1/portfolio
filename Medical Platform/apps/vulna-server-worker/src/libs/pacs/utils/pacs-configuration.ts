import {
	CONFIGURATION_KEY,
	type ConfigurationKey,
	type ConfigurationValues,
	MILLISECONDS_PER_SECOND,
	requiredIntegerOf,
	textValueOf,
} from "@ansora/core-server"
import type { DimseTimeouts } from "@ansora/vulna-adapter-dicom-dimse"
import { isUid } from "@ansora/vulna-domain"
import type { TransferSyntax } from "@ansora/vulna-projection-dicom"

function millisecondsOf(values: ConfigurationValues, key: ConfigurationKey): number {
	return requiredIntegerOf(values, key) * MILLISECONDS_PER_SECOND
}

// ADR-005 ř. 39, integrace-dicom.md 6.3, konfigurace-a-profily.md 2.7
export function dimseTimeoutsOf(values: ConfigurationValues): DimseTimeouts {
	return {
		connectMs: millisecondsOf(values, CONFIGURATION_KEY.DICOM_CONNECT_TIMEOUT_SECONDS),
		acseMs: millisecondsOf(values, CONFIGURATION_KEY.DICOM_ACSE_TIMEOUT_SECONDS),
		dimseMs: millisecondsOf(values, CONFIGURATION_KEY.DICOM_DIMSE_TIMEOUT_SECONDS),
		idleMs: millisecondsOf(values, CONFIGURATION_KEY.DICOM_IDLE_TIMEOUT_SECONDS),
	}
}

// CAP-012-R17, integrace-dicom.md 4, Q-045
export function implementationClassUidOf(values: ConfigurationValues): string | undefined {
	const uid = textValueOf(values, CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID)
	return uid !== undefined && isUid(uid) ? uid : undefined
}

// integrace-dicom.md 3, CAP-021-R17, CAP-023-R15
export function transferSyntaxesOf(
	values: ConfigurationValues,
	key: ConfigurationKey,
	supported: readonly TransferSyntax[],
): TransferSyntax[] | undefined {
	const value = values.get(key)
	if (!Array.isArray(value) || value.length === 0 || new Set(value).size !== value.length) {
		return undefined
	}
	return value.every((item): item is TransferSyntax => supported.some((syntax) => syntax === item)) ? value : undefined
}
