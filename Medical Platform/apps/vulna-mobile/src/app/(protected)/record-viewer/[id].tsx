import { useLocalSearchParams, useRouter } from "expo-router"
import { RecordViewerPending, RecordViewerScreen } from "../../../features/record/components/RecordViewerScreen"
import { useRecordDetail } from "../../../features/record/hooks/use-record-detail"
import { LOAD_STATE } from "../../../features/remote/hooks/use-remote-content"

// CAP-020-R09, CAP-020-R17, E124, E125
export default function RecordViewerRoute() {
	const { id, file } = useLocalSearchParams<{ id: string; file?: string }>()
	const router = useRouter()
	const { state, retry } = useRecordDetail(id)
	const close = () => router.back()
	if (state.kind !== LOAD_STATE.READY) {
		return (
			<RecordViewerPending
				failure={state.kind === LOAD_STATE.FAILED ? state.failure : undefined}
				onRetry={retry}
				onClose={close}
			/>
		)
	}
	return (
		<RecordViewerScreen
			content={state}
			selectedId={file}
			onSelect={(next) => router.setParams({ file: next })}
			onClose={close}
		/>
	)
}
