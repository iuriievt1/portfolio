import { useRouter } from "expo-router"
import { QueueSheet } from "../../features/upload/components/QueueSheet"

// CAP-019-R08, E53
export default function QueueRoute() {
	const router = useRouter()
	return <QueueSheet onClose={() => router.back()} />
}
