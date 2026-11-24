const HOME_SEGMENTS: readonly string[] = ["(protected)", "overview"]
const VISIT_SEGMENT = "visit"
const FLOW_AFTER_VISIT = 2
const DRAFT_FLOW_SEGMENTS: ReadonlySet<string> = new Set(["capture", "scan"])

function isHome(segments: readonly string[]): boolean {
	return (
		segments.length === HOME_SEGMENTS.length && HOME_SEGMENTS.every((segment, index) => segments[index] === segment)
	)
}

// CAP-012-R25
export function isInDraftFlow(segments: readonly string[]): boolean {
	const visit = segments.indexOf(VISIT_SEGMENT)
	return visit >= 0 && DRAFT_FLOW_SEGMENTS.has(segments[visit + FLOW_AFTER_VISIT] ?? "")
}

// CAP-012-R25, CHG-180
export function leavesForUpdateScreen(segments: readonly string[]): boolean {
	return !(isHome(segments) || isInDraftFlow(segments))
}
