import { Modal, ScrollView, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { SheetHeader } from "../../../ui/SheetHeader"
import { Body, Detail, Label } from "../../../ui/typography"
import { ApprovalCode } from "./ApprovalCode"

export interface DeviceDetails {
	model: string
	system: string
	version: string
}

interface Props {
	code: string
	details: DeviceDetails | undefined
	onClose: () => void
}

export function ItInformationSheet({ code, details, onClose }: Props) {
	const texts = useTexts().device.itInformation
	if (details === undefined) {
		return null
	}
	return (
		<Modal visible presentationStyle="pageSheet" animationType="slide" onRequestClose={onClose}>
			<View className="flex-1 bg-background android:pt-safe">
				<SheetHeader title={texts.heading} closeLabel={texts.close} onClose={onClose} />
				<ScrollView contentContainerClassName="grow items-center">
					<View className="w-full max-w-entry px-screen pt-sheet pb-safe-gap-or-6">
						<Body>{texts.body}</Body>
						<ApprovalCode code={code} />
						<DeviceValues details={details} />
					</View>
				</ScrollView>
			</View>
		</Modal>
	)
}

function DeviceValues({ details }: { details: DeviceDetails }) {
	const texts = useTexts().device.itInformation
	return (
		<View className="mt-6 gap-values rounded-control border border-border bg-card px-4 py-value-edge">
			<Value label={texts.model} value={details.model} />
			<Value label={texts.system} value={details.system} />
			<Value label={texts.version} value={details.version} />
		</View>
	)
}

function Value({ label, value }: { label: string; value: string }) {
	return (
		<View>
			<Detail>{label}</Detail>
			<Label className="pt-1">{value}</Label>
		</View>
	)
}
