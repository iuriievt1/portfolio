import type { BodyDiagramDrawing, BodyView, DiagramPoint } from "@ansora/contracts"
import { useCallback, useMemo, useRef, useState } from "react"
import { randomUuid } from "../../../utils/random-uuid"
import {
	captureSessionOf,
	chooseWound,
	clearWound,
	WOUND_CHOICE,
	type WoundChoice,
} from "../../capture/capture-session"
import { bodySiteOfTouch } from "../body-site-of-touch"
import { keyedChoice, restoredChoiceOf } from "../location-update"
import { drawingOfView, type LocatedFinding } from "../wound-map-layout"
import type { LocationData } from "./use-location-data"

export interface LocationStep {
	selection: WoundChoice | undefined
	focusedView: BodyView | undefined
	shownDrawing: BodyDiagramDrawing
	markAt: (point: DiagramPoint) => void
	chooseFinding: (wound: LocatedFinding) => void
	clear: () => void
	settle: () => Promise<WoundChoice | undefined>
}

// CAP-015-R31, CAP-016-R17, CAP-016-S02, CAP-016-S10, CAP-016-S11
export function useLocationStep(acquisitionId: string, data: LocationData): LocationStep {
	const [selection, setSelection] = useState<WoundChoice | undefined>(() =>
		restoredChoiceOf(captureSessionOf(acquisitionId), data.draft, data.wounds, data.drawing),
	)
	const current = useRef(selection)
	current.current = selection
	const focusedView = selection?.bodySite.view
	const shownDrawing = useMemo(
		() => (focusedView === undefined ? undefined : drawingOfView(data.drawing, focusedView)) ?? data.drawing,
		[data.drawing, focusedView],
	)

	// CAP-016-R14
	const select = useCallback(
		(choice: WoundChoice) => {
			setSelection(choice)
			chooseWound(acquisitionId, choice)
		},
		[acquisitionId],
	)

	const markAt = useCallback(
		(point: DiagramPoint) => {
			const bodySite = bodySiteOfTouch(shownDrawing, data.regions, point)
			if (bodySite !== undefined) {
				select({ kind: WOUND_CHOICE.NEW, bodySite, findingKey: undefined })
			}
		},
		[shownDrawing, data.regions, select],
	)

	const chooseFinding = useCallback(
		(wound: LocatedFinding) => {
			select({ kind: WOUND_CHOICE.EXISTING, finding: wound.finding, bodySite: wound.bodySite })
		},
		[select],
	)

	// CAP-016-R14
	const clear = useCallback(() => {
		setSelection(undefined)
		clearWound(acquisitionId)
	}, [acquisitionId])

	// CAP-021-R29
	const settle = useCallback(async () => {
		const chosen = current.current
		const keyed = await keyedChoice(chosen, randomUuid)
		if (keyed !== chosen) {
			current.current = keyed
			setSelection((previous) => (previous === chosen ? keyed : previous))
		}
		return keyed
	}, [])

	return { selection, focusedView, shownDrawing, markAt, chooseFinding, clear, settle }
}
