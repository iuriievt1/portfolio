import { useRouter } from "expo-router"
import { SettingsSheet } from "../../features/settings/components/SettingsSheet"

// CAP-002-R20, CAP-015-R25
export default function Settings() {
	const router = useRouter()
	return <SettingsSheet onClose={() => router.back()} />
}
