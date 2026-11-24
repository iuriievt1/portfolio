import { isPinEntryComplete } from "@ansora/core-mobile"
import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { Label } from "../../../ui/typography"
import { PinEntryFrame, type PinMessage } from "./PinEntryFrame"
import { UnlockMethods, type UnlockMethodsProps } from "./UnlockMethods"

interface Props {
	heading: string
	message: PinMessage
	pin: string
	locked: boolean
	verifying: boolean
	accountName: string
	action: string
	methods: UnlockMethodsProps
	onDigit: (digit: string) => void
	onErase: () => void
	onConfirm: () => void
	onChangeAccount: () => void
}

export function PinScreen(props: Props) {
	const strings = useTexts()
	const controlsLocked = props.locked || props.verifying
	return (
		<PinEntryFrame
			heading={props.heading}
			message={props.message}
			pin={props.pin}
			keypadDisabled={controlsLocked}
			onDigit={props.onDigit}
			onErase={props.onErase}
		>
			<AccountRow name={props.accountName} disabled={controlsLocked} onChange={props.onChangeAccount} />
			<UnlockMethods {...props.methods} disabled={controlsLocked} />
			<Button
				label={props.verifying ? strings.unlock.verifying.action : props.action}
				onPress={props.onConfirm}
				disabled={controlsLocked || !isPinEntryComplete(props.pin)}
				waiting={props.verifying}
			/>
		</PinEntryFrame>
	)
}

function AccountRow({ name, disabled, onChange }: { name: string; disabled: boolean; onChange: () => void }) {
	const strings = useTexts()
	return (
		<View className="min-h-identity flex-row items-center gap-4">
			<Label className="flex-1">{name}</Label>
			<Button label={strings.unlock.changeAccount} onPress={onChange} style={BUTTON_STYLE.PLAIN} disabled={disabled} />
		</View>
	)
}
