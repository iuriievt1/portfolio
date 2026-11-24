import { useLocalSearchParams, useRouter } from "expo-router"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { DraftStepDialogs } from "../../../../../features/capture/components/DraftStepDialogs"
import { useDraftStepSave } from "../../../../../features/capture/hooks/use-draft-step-save"
import { CustomTitleSheet } from "../../../../../features/scan/components/CustomTitleSheet"
import { titleTextUpdateOf } from "../../../../../features/scan/document-title"
import { type ScanOrigin, useScanFlow } from "../../../../../features/scan/hooks/use-scan-flow"
import { useTexts } from "../../../../../i18n/language-store"

// CAP-018-R15, CAP-015-R30
export default function CustomTitleRoute() {
	const { id, acquisitionId, origin } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		origin?: ScanOrigin
	}>()
	const texts = useTexts()
	const router = useRouter()
	const { draft } = useCaptureSession(acquisitionId)
	const saving = useDraftStepSave(acquisitionId)
	const flow = useScanFlow(id, acquisitionId)

	const save = async (title: string) => {
		const saved = await saving.save((current) => titleTextUpdateOf(current, title))
		if (saved) {
			router.back()
			flow.afterTitle(origin)
		}
	}

	return (
		<>
			<CustomTitleSheet
				title={draft?.document_title?.text ?? ""}
				isSaving={saving.isSaving}
				onSave={(title) => void save(title)}
				onClose={() => router.back()}
			/>
			<DraftStepDialogs
				failure={saving.failure}
				serverErrorHeading={texts.scan.documentTitle.saveFailed}
				onDismiss={saving.dismiss}
				onReload={saving.reload}
			/>
		</>
	)
}
