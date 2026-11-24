import { useRouter } from "expo-router"
import { useCallback } from "react"
import type { AcquisitionDraftSummary } from "../../api/acquisitions"
import type { UnfinishedEncounterItem } from "../../api/encounters"
import type { Patient } from "../../api/patients"
import { useAppVersionRejected } from "../../features/app-version/app-version-store"
import { SessionAppUpdateScreen, type StartedDraft } from "../../features/app-version/components/SessionAppUpdateScreen"
import { useStartedDrafts } from "../../features/app-version/hooks/use-started-drafts"
import { openOwnDraft } from "../../features/drafts/open-own-draft"
import { IdentificationDialogs } from "../../features/identification/components/IdentificationDialogs"
import { type MatchingPatients, offerMatchingPatients } from "../../features/identification/matching-patients"
import { OperatorNoticeDialog } from "../../features/operator-notices/components/OperatorNoticeDialog"
import { useOperatorNotices } from "../../features/operator-notices/hooks/use-operator-notices"
import { operatorNoticeOf } from "../../features/operator-notices/operator-notice"
import { OverviewScreen } from "../../features/overview/components/OverviewScreen"
import { homeDraftRows, isScheduledSectionOn, useOverview } from "../../features/overview/hooks/use-overview"
import { usePatientFinder } from "../../features/overview/hooks/use-patient-finder"
import { usePatientSearch } from "../../features/overview/hooks/use-patient-search"
import { openPatient } from "../../features/patient/opened-patient"
import { QueueNotices } from "../../features/queue-notices/components/QueueNotices"
import { LOAD_STATE } from "../../features/remote/hooks/use-remote-content"
import { effectiveConfiguration } from "../../features/session/effective-configuration-store"
import { useLockAction } from "../../features/session/session-lock-context"
import { currentSession } from "../../features/session/session-store"
import { useWaitingFileCount } from "../../features/upload/hooks/use-waiting-file-count"
import { draftRouteOf } from "../../features/visit/draft-route"
import { openVisit } from "../../features/visit/opened-visit"
import { useTexts } from "../../i18n/language-store"
import { ROUTE } from "../../navigation/routes"

export default function OverviewRoute() {
	return useAppVersionRejected() ? <SessionAppUpdate /> : <Overview />
}

// CAP-012-R25, CAP-012-S30, E59
function SessionAppUpdate() {
	const router = useRouter()
	const drafts = useStartedDrafts()
	const waitingFiles = useWaitingFileCount()

	const startedDraftOf = (summary: AcquisitionDraftSummary): StartedDraft => {
		const pathname = draftRouteOf(summary.kind)
		const encounterId = summary.encounter_id ?? undefined
		if (pathname === undefined || encounterId === undefined) {
			return { summary, finish: undefined }
		}
		const finish = () => {
			const id = openVisit({ patient: summary.patient, encounterId, encounterKey: undefined, openedAt: new Date() })
			router.push({ pathname, params: { id, acquisitionId: summary.acquisition_id } })
		}
		return { summary, finish }
	}

	return <SessionAppUpdateScreen drafts={drafts.map(startedDraftOf)} waitingFiles={waitingFiles} />
}

// CAP-013-R18, CAP-013-R19, CAP-014-R16, CAP-014-R18, CAP-014-R23, CAP-015-R29, CAP-015-R20, CAP-015-R18, CAP-019-R25
function Overview() {
	const router = useRouter()
	const texts = useTexts()
	const lock = useLockAction()
	const overview = useOverview()
	const notices = useOperatorNotices()
	const overviewState = overview.state
	const ownDrafts = overviewState.kind === LOAD_STATE.READY ? overviewState.drafts : []
	const notice =
		notices.current === undefined || overviewState.kind === LOAD_STATE.LOADING
			? undefined
			: operatorNoticeOf(notices.current, ownDrafts, texts)

	const showPatient = useCallback(
		(patient: Patient) => {
			openPatient(patient)
			router.push({ pathname: ROUTE.PATIENT, params: { id: patient.patient_id } })
		},
		[router],
	)

	// CAP-014-R20, CAP-014-R22, CAP-014-R30
	const showUnfinishedVisit = useCallback(
		(item: UnfinishedEncounterItem) => {
			const id = openVisit({
				patient: item.patient,
				encounterId: item.encounter.encounter_id,
				encounterKey: undefined,
				openedAt: new Date(),
			})
			router.push({ pathname: ROUTE.VISIT, params: { id } })
		},
		[router],
	)

	const offerMatches = useCallback(
		(matches: MatchingPatients) => {
			offerMatchingPatients(matches)
			router.push(ROUTE.PATIENT_CHOICE)
		},
		[router],
	)

	const finder = usePatientFinder({ onPatient: showPatient, onMatches: offerMatches })
	// CAP-013-R07, CAP-013-R18, CHG-182
	const search = usePatientSearch(effectiveConfiguration()?.patient_code?.system, showPatient)

	return (
		<>
			<OverviewScreen
				userName={currentSession()?.user.display_name ?? ""}
				overview={overview.state}
				withScheduled={isScheduledSectionOn()}
				draftRows={homeDraftRows()}
				identification={finder.identification}
				search={search}
				onRetry={overview.retry}
				onDraft={(draft) => router.push(openOwnDraft(draft))}
				onAllDrafts={() => router.push(ROUTE.DRAFTS)}
				onUnfinished={showUnfinishedVisit}
				onScheduled={(item) => showPatient(item.patient)}
				onRecent={(item) => showPatient(item.patient)}
				onLock={lock}
				onSettings={() => router.push(ROUTE.SETTINGS)}
			/>
			<IdentificationDialogs flow={finder.flow} />
			{notice === undefined ? null : (
				<OperatorNoticeDialog
					notice={notice}
					isAcknowledging={notices.isAcknowledging}
					onAcknowledge={() => void notices.acknowledge(notice.notificationId)}
					onShow={(draft) => {
						void notices.acknowledge(notice.notificationId)
						router.push(openOwnDraft(draft))
					}}
				/>
			)}
			<QueueNotices drafts={ownDrafts} isHidden={notice !== undefined || overviewState.kind !== LOAD_STATE.READY} />
		</>
	)
}
