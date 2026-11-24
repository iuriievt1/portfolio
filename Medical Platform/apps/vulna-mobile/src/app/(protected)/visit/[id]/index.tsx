import { ACQUISITION_KIND, ACQUISITION_STATE_VALUE, type AcquisitionKind } from "@ansora/contracts"
import { DocumentScannerView } from "@ansora/core-mobile"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { useCallback, useEffect, useRef } from "react"
import type { AcquisitionReceipt } from "../../../../api/acquisitions"
import type { EncounterAcquisitionItem } from "../../../../api/encounters"
import { REMOTE_FAILURE } from "../../../../api/remote-failure"
import { LOAD_STATE, LOADING } from "../../../../features/remote/hooks/use-remote-content"
import { CancellationDialogs } from "../../../../features/visit/components/CancellationDialogs"
import { DraftCreationDialogs } from "../../../../features/visit/components/DraftCreationDialogs"
import { MoveStartDialogs } from "../../../../features/visit/components/MoveStartDialogs"
import { VisitScreen } from "../../../../features/visit/components/VisitScreen"
import { draftRouteOf } from "../../../../features/visit/draft-route"
import { CLOSED_VISIT, DRAFT_CREATION, useDraftCreation } from "../../../../features/visit/hooks/use-draft-creation"
import { useMoveStart } from "../../../../features/visit/hooks/use-move-start"
import { useVisit } from "../../../../features/visit/hooks/use-visit"
import { useVisitCancellation } from "../../../../features/visit/hooks/use-visit-cancellation"
import { openNewVisit } from "../../../../features/visit/new-visit"
import { type OpenedVisit, openedVisit, openVisit } from "../../../../features/visit/opened-visit"
import { visitMomentOf, visitWhenOf } from "../../../../features/visit/visit-view"
import { useTexts } from "../../../../i18n/language-store"
import { ROUTE } from "../../../../navigation/routes"

// CAP-014-R22
export default function VisitRoute() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const visit = openedVisit(id)
	if (visit === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <Visit routeId={id} visit={visit} />
}

function Visit({ routeId, visit }: { routeId: string; visit: OpenedVisit }) {
	const router = useRouter()
	const texts = useTexts()
	const { state, finish, retry, askToFinish, confirmFinish, dismissFinish } = useVisit(visit)
	const close = useCallback(() => router.back(), [router])

	const reloadAfter = (dismiss: () => void) => {
		dismiss()
		retry()
	}

	// CAP-014-R06
	const openVisitOf = useCallback(
		(receipt: AcquisitionReceipt): string => {
			const encounterId = receipt.encounter_id
			if (visit.encounterId !== undefined || encounterId === undefined) {
				return routeId
			}
			return openVisit({ patient: visit.patient, encounterId, encounterKey: undefined, openedAt: visit.openedAt })
		},
		[visit, routeId],
	)

	const showVisit = useCallback(
		(id: string) => {
			if (id === routeId) {
				retry()
				return
			}
			router.replace({ pathname: ROUTE.VISIT, params: { id } })
		},
		[routeId, retry, router],
	)

	// CAP-015-R31, CAP-018-R14
	const showCreated = useCallback(
		(receipt: AcquisitionReceipt, kind: AcquisitionKind) => {
			const id = openVisitOf(receipt)
			showVisit(id)
			const pathname = draftRouteOf(kind)
			if (pathname !== undefined) {
				router.push({ pathname, params: { id, acquisitionId: receipt.acquisition_id } })
			}
		},
		[openVisitOf, showVisit, router],
	)

	const drafts = useDraftCreation(visit, showCreated)

	// CAP-015-R18, CAP-015-S14, E56
	const showOwnDrafts = useCallback(() => {
		drafts.dismiss()
		router.push({ pathname: ROUTE.VISIT_DRAFTS, params: { id: routeId } })
	}, [drafts, router, routeId])

	// CAP-014-R05, CAP-014-R06, CAP-014-R29, E105, E121
	const showNewVisit = useCallback(async () => {
		drafts.dismiss()
		router.replace({ pathname: ROUTE.VISIT, params: { id: await openNewVisit(visit.patient) } })
	}, [drafts, visit, router])

	// CAP-014-R21, CAP-014-R30, E105, E121
	const reloadVisit = useCallback(() => {
		drafts.dismiss()
		if (visit.encounterId === undefined) {
			close()
			return
		}
		retry()
	}, [drafts, visit, retry, close])

	// CAP-014-R29
	const leaveClosedVisit = useCallback(() => {
		const creation = drafts.creation
		if (creation.kind === DRAFT_CREATION.VISIT_CLOSED && creation.reason === CLOSED_VISIT.CANCELLED) {
			drafts.dismiss()
			close()
			return
		}
		reloadVisit()
	}, [drafts, close, reloadVisit])

	// CAP-014-R29, CAP-015-S54
	const isLeavingCancelledVisit = useRef(false)
	const isCancelledVisit =
		state.kind === LOAD_STATE.FAILED && state.failure === REMOTE_FAILURE.NOT_FOUND && visit.encounterId !== undefined
	useEffect(() => {
		if (!isCancelledVisit || isLeavingCancelledVisit.current) {
			return
		}
		isLeavingCancelledVisit.current = true
		showNewVisit().catch((failure: unknown) => {
			isLeavingCancelledVisit.current = false
			console.warn("a new visit could not be opened", failure)
		})
	}, [isCancelledVisit, showNewVisit])

	const cancellation = useVisitCancellation(visit.encounterId, close)

	const showMovePatient = useCallback(
		() => router.push({ pathname: ROUTE.MOVE_PATIENT, params: { id: routeId } }),
		[router, routeId],
	)

	const moves = useMoveStart(visit, showMovePatient)

	// CAP-015-R29, CAP-015-S04, CAP-014-R23, CAP-020-R17, E101, E108
	const openRecordOf = useCallback(
		(record: EncounterAcquisitionItem) => {
			const params = { id: routeId, acquisitionId: record.acquisition_id }
			const pathname = draftRouteOf(record.kind)
			switch (record.state) {
				case ACQUISITION_STATE_VALUE.DRAFT:
					return pathname === undefined ? undefined : () => router.push({ pathname, params })
				case ACQUISITION_STATE_VALUE.RECEIVED:
					return () => router.push({ pathname: ROUTE.RECORD_DETAIL, params: { id: record.acquisition_id } })
				default:
					return undefined
			}
		},
		[router, routeId],
	)

	const encounter = state.kind === LOAD_STATE.READY ? state.encounter : undefined
	const when = visitMomentOf(visitWhenOf(encounter, visit.openedAt, texts.language), texts)

	return (
		<>
			<VisitScreen
				visit={visit}
				state={isCancelledVisit ? LOADING : state}
				finish={finish}
				additions={{
					onPhoto: () => void drafts.create(ACQUISITION_KIND.PHOTO),
					// CAP-018-R14
					onScan: DocumentScannerView === undefined ? undefined : () => void drafts.create(ACQUISITION_KIND.SCAN),
				}}
				openRecordOf={openRecordOf}
				onMoveRecord={(record) => void moves.start(record)}
				onCancelVisit={cancellation.ask}
				onRetry={retry}
				onFinish={askToFinish}
				onConfirmFinish={() => void confirmFinish()}
				onDismissFinish={dismissFinish}
				onClose={close}
			/>
			<DraftCreationDialogs
				creation={drafts.creation}
				onDismiss={drafts.dismiss}
				onShowDrafts={showOwnDrafts}
				onNewVisit={() =>
					void showNewVisit().catch((failure: unknown) => console.warn("a new visit could not be opened", failure))
				}
				onVisitCompleted={reloadVisit}
				onVisitClosed={leaveClosedVisit}
			/>
			<CancellationDialogs
				cancellation={cancellation.cancellation}
				when={when}
				onConfirm={() => void cancellation.confirm()}
				onDismiss={cancellation.dismiss}
				onRefused={() => reloadAfter(cancellation.dismiss)}
			/>
			<MoveStartDialogs
				moveStart={moves.moveStart}
				onDismiss={moves.dismiss}
				onClosedSeen={() => reloadAfter(moves.dismiss)}
			/>
		</>
	)
}
