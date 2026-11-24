import { useRouter } from "expo-router"
import { View } from "react-native"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useTexts } from "../../../i18n/language-store"
import { Button } from "../../../ui/Button"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { WarningIcon } from "../../../ui/icons/WarningIcon"
import { Detail, Label } from "../../../ui/typography"
import { countText } from "../../../utils/fill-text"
import { openOwnDraftSummary } from "../../drafts/open-own-draft"
import { draftDetailOf } from "../../overview/overview-rows"
import { patientNumberOf } from "../../patient/patient-identity"
import { SignOutDialogs } from "../../session/components/SignOutDialogs"
import { SignOutNotice } from "../../session/components/SignOutNotice"
import { useSignOut } from "../../session/hooks/use-sign-out"
import { useQueuedRecordMarks } from "../../upload/hooks/use-queued-record-marks"
import { recordNoteOf } from "../../upload/record-note"
import { useVersionNote } from "../hooks/use-version-note"

export interface StartedDraft {
	summary: AcquisitionDraftSummary
	finish: (() => void) | undefined
}

interface Props {
	drafts: readonly StartedDraft[]
	waitingFiles: number | undefined
}

const CARD = "gap-1 rounded-control bg-card px-4 py-3"

// CAP-012-R25, CAP-012-S30, E59, CAP-015-R16, CAP-002-R14
export function SessionAppUpdateScreen({ drafts, waitingFiles }: Props) {
	const strings = useTexts()
	const texts = strings.appUpdate
	const router = useRouter()
	const flow = useSignOut()
	const versionNote = useVersionNote()
	const marks = useQueuedRecordMarks()
	const now = new Date()
	const hasWaitingFiles = waitingFiles !== undefined && waitingFiles > 0
	return (
		<FeedbackScreen
			icon={<WarningIcon />}
			heading={texts.heading}
			body={texts.inSession}
			note={versionNote}
			secondary={{
				label: strings.session.signOut.action,
				onPress: flow.signOut,
				waiting: flow.isBusy,
			}}
		>
			{drafts.length === 0 && !hasWaitingFiles ? null : (
				<View className="gap-3 pt-6">
					{drafts.map(({ summary, finish }) => (
						<View key={summary.acquisition_id} className={CARD}>
							<Label>{patientNumberOf(summary.patient)}</Label>
							<Detail>{draftDetailOf(summary, now, strings, recordNoteOf(summary, marks))}</Detail>
							{finish === undefined ? null : (
								<View className="pt-2">
									<Button label={texts.finishDraft} onPress={finish} />
								</View>
							)}
						</View>
					))}
					{hasWaitingFiles ? (
						<View className={CARD}>
							<Label>{countText(texts.waitingFiles, waitingFiles, strings.language)}</Label>
							<Detail>{texts.nothingDeleted}</Detail>
						</View>
					) : null}
				</View>
			)}
			<SignOutNotice state={flow.state} onRetry={flow.signOut} />
			<SignOutDialogs
				flow={flow}
				canDiscard={false}
				onCloseThroughSummary={(draft) => {
					flow.closeThroughSummary(draft)
					router.push(openOwnDraftSummary(draft))
				}}
				onShowDrafts={undefined}
				onShowQueue={undefined}
			/>
		</FeedbackScreen>
	)
}
