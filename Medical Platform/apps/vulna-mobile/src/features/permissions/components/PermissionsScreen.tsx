import type { ReactNode } from "react"
import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { EntryScreen } from "../../../ui/EntryScreen"
import { CameraIcon } from "../../../ui/icons/CameraIcon"
import { NfcIcon } from "../../../ui/icons/NfcIcon"
import { Detail, Label } from "../../../ui/typography"

interface Props {
	onAllow: () => void
}

export function PermissionsScreen({ onAllow }: Props) {
	const strings = useTexts()
	const texts = strings.permissions
	return (
		<EntryScreen heading={texts.heading} body={texts.body} action={{ label: texts.action, onPress: onAllow }}>
			<View className="gap-4 pt-6">
				<Requested icon={<CameraIcon />} title={texts.camera.title} body={texts.camera.body} />
				<Requested icon={<NfcIcon />} title={texts.nfc.title} body={texts.nfc.body} />
			</View>
			<Detail className="pt-6">{texts.note}</Detail>
		</EntryScreen>
	)
}

function Requested({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
	return (
		<View className="flex-row gap-3">
			<View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary">{icon}</View>
			<View className="flex-1">
				<Label>{title}</Label>
				<Detail className="pt-1">{body}</Detail>
			</View>
		</View>
	)
}
