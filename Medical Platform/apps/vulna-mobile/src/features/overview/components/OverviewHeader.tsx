import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { BrandHeader, HEADER_INSET } from "../../../ui/Brand"
import { GlassAction } from "../../../ui/GlassAction"
import { LockIcon } from "../../../ui/icons/LockIcon"
import { SettingsIcon } from "../../../ui/icons/SettingsIcon"
import { SYSTEM_SYMBOL, SystemSymbol } from "../../../ui/SystemSymbol"
import { Heading, TEXT_TONE } from "../../../ui/typography"

interface Props {
	userName: string
	onLock: () => void
	onSettings: () => void
}

// CAP-002-R20, E89
export function OverviewHeader({ userName, onLock, onSettings }: Props) {
	const texts = useTexts()
	return (
		<BrandHeader inset={HEADER_INSET.OVERVIEW}>
			<Heading className="flex-1" tone={TEXT_TONE.ON_BRAND}>
				{userName}
			</Heading>
			<View className="flex-row gap-5">
				<GlassAction label={texts.session.lock} onPress={onLock}>
					<SystemSymbol name={SYSTEM_SYMBOL.LOCK} fallback={<LockIcon />} />
				</GlassAction>
				<GlassAction label={texts.settings.title} onPress={onSettings}>
					<SystemSymbol name={SYSTEM_SYMBOL.SETTINGS} fallback={<SettingsIcon />} />
				</GlassAction>
			</View>
		</BrandHeader>
	)
}
