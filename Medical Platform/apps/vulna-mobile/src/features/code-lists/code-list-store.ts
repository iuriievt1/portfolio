import type { BodyDiagramDrawing } from "@ansora/contracts"
import { type BodyDiagramRegion, type CodeListSet, codeListApi } from "../../api/code-lists"
import { sessionCaller } from "../session/session-actions"
import { drawingOf, forgetBodyDiagramDrawing } from "./body-diagram-drawing"
import { codeListsAfter } from "./code-list-version"

const NO_REGIONS: readonly BodyDiagramRegion[] = []

let known: CodeListSet | undefined

// CAP-007-R04
export function forgetCodeLists(): void {
	known = undefined
	forgetBodyDiagramDrawing()
}

// CAP-017-R18, CAP-015-S25, ADR-023
export async function syncCodeLists(): Promise<CodeListSet> {
	const received = await sessionCaller.call((sessionToken) => codeListApi.syncCodeLists(sessionToken, known?.version))
	known = codeListsAfter(known, received)
	return known
}

// CAP-016-R18
export function knownRegions(): readonly BodyDiagramRegion[] {
	return known?.body_diagram.regions ?? NO_REGIONS
}

// CAP-016-R07
export async function bodyDiagramDrawing(codeLists: CodeListSet): Promise<BodyDiagramDrawing> {
	return await drawingOf(codeLists.body_diagram, (backgroundUrl) =>
		sessionCaller.call((sessionToken) => codeListApi.getBodyDiagramBackground(sessionToken, backgroundUrl)),
	)
}
