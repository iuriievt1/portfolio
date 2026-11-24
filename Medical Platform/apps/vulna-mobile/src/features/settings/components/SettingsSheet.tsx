import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { SheetHeader } from "../../../ui/SheetHeader"
import { LanguageSection } from "./LanguageSection"
import { SignOutSection } from "./SignOutSection"

// CAP-002-R20
export function SettingsSheet({ onClose }: { onClose: () => void }) {
	const texts = useTexts().settings
	return (
		<View className="bg-card">
			<SheetHeader title={texts.title} closeLabel={texts.close} onClose={onClose} />
			<View className="gap-6 px-screen pt-6 pb-safe-gap-or-6">
				<LanguageSection />
				<SignOutSection />
			</View>
		</View>
	)
}
