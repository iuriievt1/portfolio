import { useLocalSearchParams, useRouter } from "expo-router"
import { RecordDetailScreen } from "../../../features/record/components/RecordDetailScreen"
import { useRecordDetail } from "../../../features/record/hooks/use-record-detail"
import { ROUTE } from "../../../navigation/routes"

// CAP-020-R17, E108
export default function RecordRoute() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const router = useRouter()
	const { state, retry } = useRecordDetail(id)
	return (
		<RecordDetailScreen
			state={state}
			onBack={() => router.back()}
			onRetry={retry}
			onOpenFile={(file) => router.push({ pathname: ROUTE.RECORD_VIEWER, params: { id, file } })}
		/>
	)
}
