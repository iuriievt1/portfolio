import type { CodeListSet } from "../../api/code-lists"

// CAP-017-R18, CAP-015-S25, ADR-023
export function codeListsAfter(known: CodeListSet | undefined, received: CodeListSet): CodeListSet {
	return known === undefined || received.version !== known.version ? received : known
}
