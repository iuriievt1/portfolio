import { PERSONAL_NUMBER_MAX_LENGTH } from "@ansora/contracts"
import { ScrollView, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { ENTRY_COLUMN } from "../../../ui/EntryLayout"
import { Body, Caption, Detail, TEXT_TONE } from "../../../ui/typography"
import { KEYPAD_STYLE, PinKeypad } from "./PinKeypad"

interface Props {
	number: string
	unknown: boolean
	onChangeNumber: (number: string) => void
	onContinue: () => void
	onSignInWithAccount: () => void
}

export function ChangeAccountScreen({ number, unknown, onChangeNumber, onContinue, onSignInWithAccount }: Props) {
	const strings = useTexts()
	const texts = strings.unlock.account
	const digit = (entered: string) => {
		if (number.length < PERSONAL_NUMBER_MAX_LENGTH) {
			onChangeNumber(`${number}${entered}`)
		}
	}
	const erase = () => onChangeNumber(number.slice(0, -1))
	return (
		<View className="flex-1 bg-card">
			<ScrollView contentContainerClassName="grow">
				<View className={`${ENTRY_COLUMN} gap-4 pt-4`}>
					<Detail>{texts.body}</Detail>
					<View className={`gap-1 rounded-field bg-card p-field ${fieldBorder(unknown)}`}>
						<Caption tone={TEXT_TONE.MUTED}>{texts.field}</Caption>
						<Body tone={TEXT_TONE.DEFAULT} className="min-h-6" accessibilityLabel={texts.field}>
							{number}
						</Body>
					</View>
					{unknown ? <Caption tone={TEXT_TONE.ERROR}>{texts.unknown}</Caption> : null}
				</View>
			</ScrollView>
			<View className={`${ENTRY_COLUMN} gap-2`}>
				<Button label={texts.action} onPress={onContinue} disabled={number.length === 0 || unknown} />
				<Button label={texts.signInWithAccount} onPress={onSignInWithAccount} style={BUTTON_STYLE.PLAIN} />
			</View>
			<View className="mt-4 rounded-t-keyboard bg-keyboard">
				<View className="w-full max-w-entry self-center px-keyboard-edge pt-6 pb-safe-offset-keyboard-bottom">
					<PinKeypad style={KEYPAD_STYLE.KEYBOARD} onDigit={digit} onErase={erase} />
				</View>
			</View>
		</View>
	)
}

function fieldBorder(unknown: boolean): string {
	return unknown ? "border border-destructive" : "border-ring border-primary"
}
