import type { DeviceStatus } from "@ansora/core-mobile"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { type EntryAction, EntryScreen } from "../../../ui/EntryScreen"
import { Label } from "../../../ui/typography"

interface Props {
	status: DeviceStatus
	onRetry?: () => void
}

export function DeviceStatusScreen({ status, onRetry }: Props) {
	const strings = useTexts()
	const texts = strings.device[status.kind]
	return (
		<EntryScreen heading={texts.heading} body={texts.body} action={retry(strings, status, onRetry)}>
			{status.fingerprint === undefined ? null : <Label className="pt-6">{status.fingerprint}</Label>}
		</EntryScreen>
	)
}

function retry(strings: Texts, status: DeviceStatus, onPress: (() => void) | undefined): EntryAction | undefined {
	const texts = strings.device[status.kind]
	if (!("action" in texts) || onPress === undefined) {
		return undefined
	}
	return { label: texts.action, onPress }
}
