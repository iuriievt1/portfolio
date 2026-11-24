import type { FindingRow } from "../types/finding.types"
import type { ClosedWoundTypeFields, WoundTypeValue } from "../types/finding-history.types"

// CAP-020-R19, CAP-020-R21, ADR-006
export function closedWoundTypeOf(record: ClosedWoundTypeFields): WoundTypeValue {
	return { code: record.closed_wound_type_code, codeListVersion: record.closed_wound_type_code_list_version }
}

// ADR-054 bod 2, CAP-020-R19
export function historyWoundTypeOf(
	finding: Pick<FindingRow, "wound_type_code" | "wound_type_code_list_version">,
	code: string | undefined,
): WoundTypeValue {
	if (code === undefined) {
		return { code: null, codeListVersion: null }
	}
	return { code, codeListVersion: finding.wound_type_code === code ? finding.wound_type_code_list_version : null }
}
