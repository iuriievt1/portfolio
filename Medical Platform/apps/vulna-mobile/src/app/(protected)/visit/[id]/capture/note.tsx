import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { noteUpdateOf } from "../../../../../features/assessment/assessment-update"
import { NoteSheet } from "../../../../../features/assessment/components/NoteSheet"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { DraftStepDialogs } from "../../../../../features/capture/components/DraftStepDialogs"
import { useDraftStepSave } from "../../../../../features/capture/hooks/use-draft-step-save"
import { useTexts } from "../../../../../i18n/language-store"
import { ROUTE } from "../../../../../navigation/routes"

// CAP-017-R04, CAP-017-S04, CAP-015-R30, CAP-017-R16
export default function NoteRoute() {
	const { id, acquisitionId } = useLocalSearchParams<{ id: string; acquisitionId: string }>()
	const texts = useTexts()
	const router = useRouter()
	const { draft } = useCaptureSession(acquisitionId)
	const saving = useDraftStepSave(acquisitionId)

	if (draft === undefined) {
		return <Redirect href={{ pathname: ROUTE.CAPTURE_SUMMARY, params: { id, acquisitionId } }} />
	}

	const save = async (note: string) => {
		const saved = await saving.save((current) => noteUpdateOf(current, note))
		if (saved) {
			router.back()
		}
	}

	return (
		<>
			<NoteSheet
				note={draft.assessment?.description ?? ""}
				isSaving={saving.isSaving}
				onSave={(note) => void save(note)}
				onClose={() => router.back()}
			/>
			<DraftStepDialogs
				failure={saving.failure}
				serverErrorHeading={texts.capture.note.saveFailed}
				onDismiss={saving.dismiss}
				onReload={saving.reload}
			/>
		</>
	)
}
