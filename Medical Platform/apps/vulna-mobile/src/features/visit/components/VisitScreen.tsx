import { ENCOUNTER_STATUS } from "@ansora/contracts"
import { type ReactNode, useState } from "react"
import { type LayoutChangeEvent, View } from "react-native"
import type { Encounter, EncounterAcquisitionItem } from "../../../api/encounters"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { ActionMenu } from "../../../ui/ActionMenu"
import { MENU_LOOK, MENU_SYMBOL, type MenuAction } from "../../../ui/action-menu"
import { Body } from "../../../ui/typography"
import { RemoteFailureState } from "../../remote/components/RemoteFailureState"
import { LOAD_STATE } from "../../remote/hooks/use-remote-content"
import { useQueuedRecordMarks } from "../../upload/hooks/use-queued-record-marks"
import { FINISH_STEP, type FinishStep, type VisitState } from "../hooks/use-visit"
import type { OpenedVisit } from "../opened-visit"
import {
	cancelUnavailableReasonOf,
	earlierNoticeOf,
	isCancellable,
	isMovable,
	VISIT_MODE,
	visitModeOf,
	visitTitleOf,
	visitWhenOf,
} from "../visit-view"
import { ActionsPanel, type VisitAdditions } from "./ActionsPanel"
import { EmptyVisit } from "./EmptyVisit"
import { FinishDialogs } from "./FinishDialogs"
import { ReadOnlyPanel } from "./ReadOnlyPanel"
import { RecordList } from "./RecordList"
import { VisitHeader } from "./VisitHeader"
import { VisitSkeleton } from "./VisitSkeleton"

const CANCEL_ACTION = "cancel"
const MOVE_ACTION = "move"

interface Props {
	visit: OpenedVisit
	state: VisitState
	finish: FinishStep
	additions: VisitAdditions
	openRecordOf: (record: EncounterAcquisitionItem) => (() => void) | undefined
	onMoveRecord: (record: EncounterAcquisitionItem) => void
	onCancelVisit: () => void
	onRetry: () => void
	onFinish: () => void
	onConfirmFinish: () => void
	onDismissFinish: () => void
	onClose: () => void
}

type ReadyState = Extract<VisitState, { kind: typeof LOAD_STATE.READY }>

// CAP-014-R20 to CAP-014-R22, CAP-014-R25, CAP-014-R30, Q-150, E100 to E104, E117, E120
export function VisitScreen(props: Props) {
	const { visit, state, onCancelVisit } = props
	const texts = useTexts()
	const isReady = state.kind === LOAD_STATE.READY
	const title = visitTitleOf(visitWhenOf(isReady ? state.encounter : undefined, visit.openedAt, texts.language), texts)
	return (
		<View className="flex-1 bg-background">
			<VisitHeader
				title={title}
				patient={visit.patient}
				leading={undefined}
				trailing={isReady ? visitMenuOf(state, onCancelVisit, texts) : undefined}
			/>
			<VisitBody {...props} />
		</View>
	)
}

function VisitBody(props: Props) {
	const { state, onRetry } = props
	const texts = useTexts()
	switch (state.kind) {
		case LOAD_STATE.LOADING:
			return <VisitSkeleton />
		case LOAD_STATE.FAILED:
			return (
				<RemoteFailureState failure={state.failure} serverErrorHeading={texts.visit.loadFailed} onRetry={onRetry} />
			)
		case LOAD_STATE.READY:
			return <VisitContent {...props} state={state} />
		default:
			return state satisfies never
	}
}

function VisitContent({
	visit,
	state,
	finish,
	additions,
	openRecordOf,
	onMoveRecord,
	onFinish,
	onConfirmFinish,
	onDismissFinish,
	onClose,
}: Props & { state: ReadyState }) {
	const texts = useTexts()
	const marks = useQueuedRecordMarks()
	const [panelHeight, setPanelHeight] = useState(0)
	const measurePanel = (event: LayoutChangeEvent) => setPanelHeight(event.nativeEvent.layout.height)
	const mode = visitModeOf(state.encounter)
	const when = visitWhenOf(state.encounter, visit.openedAt, texts.language)
	const notice = earlierNoticeOf(state.encounter, texts)
	const header = notice === undefined ? undefined : <Body className="px-screen">{notice}</Body>
	const menuOf = (record: EncounterAcquisitionItem) =>
		isMovable(record, mode) ? recordMenuOf(record, onMoveRecord, texts) : undefined
	return (
		<>
			{state.records.length === 0 && mode === VISIT_MODE.OPEN ? (
				<EmptyVisit />
			) : (
				<RecordList
					records={state.records}
					marks={marks}
					header={header}
					bottomInset={panelHeight}
					menuOf={menuOf}
					openOf={openRecordOf}
				/>
			)}
			{mode === VISIT_MODE.CLOSED ? (
				<ReadOnlyPanel
					caption={closedCaptionOf(state.encounter, texts)}
					close={texts.visit.readOnly.close}
					onClose={onClose}
					onLayout={measurePanel}
				/>
			) : (
				<ActionsPanel
					additions={mode === VISIT_MODE.OPEN ? additions : undefined}
					canFinish={state.records.length > 0}
					isFinishing={finish.kind === FINISH_STEP.FINISHING}
					onFinish={onFinish}
					onLater={onClose}
					onLayout={measurePanel}
				/>
			)}
			<FinishDialogs
				step={finish}
				patient={visit.patient}
				when={when}
				records={state.records}
				marks={marks}
				onConfirm={onConfirmFinish}
				onDismiss={onDismissFinish}
			/>
		</>
	)
}

// Q-150, HIG-09
function visitMenuOf(state: ReadyState, onCancelVisit: () => void, texts: Texts): ReactNode | undefined {
	if (!isCancellable(state.encounter)) {
		return undefined
	}
	const cancel: MenuAction = {
		key: CANCEL_ACTION,
		label: texts.visit.cancel.action,
		symbol: MENU_SYMBOL.DISCARD,
		isDestructive: true,
		unavailableReason: cancelUnavailableReasonOf(state.records, texts),
		onSelect: onCancelVisit,
	}
	return <ActionMenu label={texts.visit.menu} look={MENU_LOOK.SHEET} actions={[cancel]} />
}

// CAP-014-R25
function recordMenuOf(
	record: EncounterAcquisitionItem,
	onMoveRecord: (record: EncounterAcquisitionItem) => void,
	texts: Texts,
): ReactNode {
	const move: MenuAction = {
		key: MOVE_ACTION,
		label: texts.visit.record.move,
		symbol: MENU_SYMBOL.MOVE,
		isDestructive: false,
		unavailableReason: undefined,
		onSelect: () => onMoveRecord(record),
	}
	return <ActionMenu label={texts.visit.record.menu} look={MENU_LOOK.ROW} actions={[move]} />
}

function closedCaptionOf(encounter: Encounter | undefined, texts: Texts): string | undefined {
	return encounter?.status === ENCOUNTER_STATUS.COMPLETED ? texts.visit.readOnly.caption : undefined
}
