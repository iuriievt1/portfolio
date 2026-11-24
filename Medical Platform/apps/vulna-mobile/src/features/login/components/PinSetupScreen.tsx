import { isPinEntryComplete, PIN_POLICY_VIOLATION, type PinPolicy, type PinPolicyViolation } from "@ansora/core-mobile"
import { useCallback } from "react"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { Button } from "../../../ui/Button"
import { TEXT_TONE } from "../../../ui/typography"
import { fillText, pluralText } from "../../../utils/fill-text"
import { PinEntryFrame, type PinMessage } from "../../unlock/components/PinEntryFrame"
import { usePinEntry } from "../../unlock/hooks/use-pin-entry"

interface Props {
	policy: PinPolicy
	replacesPin: boolean
	violation: PinPolicyViolation | undefined
	verifying: boolean
	onSubmit: (pin: string) => void
}

export function PinSetupScreen({ policy, replacesPin, violation, verifying, onSubmit }: Props) {
	const strings = useTexts()
	const texts = strings.signIn.pinSetup
	const { pin, digit, erase, clear } = usePinEntry()
	const submit = useCallback(() => {
		if (isPinEntryComplete(pin)) {
			onSubmit(pin)
			clear()
		}
	}, [pin, onSubmit, clear])

	return (
		<PinEntryFrame
			heading={texts.heading}
			message={messageOf(strings, replacesPin, violation, policy)}
			pin={pin}
			keypadDisabled={verifying}
			onDigit={digit}
			onErase={erase}
		>
			<Button
				label={verifying ? strings.unlock.verifying.action : texts.action}
				onPress={submit}
				disabled={verifying || !isPinEntryComplete(pin)}
				waiting={verifying}
			/>
		</PinEntryFrame>
	)
}

function messageOf(
	strings: Texts,
	replacesPin: boolean,
	violation: PinPolicyViolation | undefined,
	policy: PinPolicy,
): PinMessage {
	const texts = strings.signIn.pinSetup
	if (violation !== undefined) {
		return { text: violationText(strings, violation, policy), tone: TEXT_TONE.ERROR }
	}
	return { text: replacesPin ? texts.replaces : texts.body, tone: TEXT_TONE.MUTED }
}

function violationText(strings: Texts, violation: PinPolicyViolation, policy: PinPolicy): string {
	const texts = strings.signIn.pinSetup.violation
	const values = { n: policy.minimumLength, rules: texts.rules }
	const forms = isLengthViolation(violation) ? texts.length : texts.complexity
	return fillText(pluralText(forms, policy.minimumLength, strings.language), values, strings.language)
}

function isLengthViolation(violation: PinPolicyViolation): boolean {
	return (
		violation === PIN_POLICY_VIOLATION.TOO_SHORT ||
		violation === PIN_POLICY_VIOLATION.TOO_LONG ||
		violation === PIN_POLICY_VIOLATION.NOT_DIGITS
	)
}
