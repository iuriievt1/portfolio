import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { BlockedIcon } from "../../../ui/icons/BlockedIcon"
import { Detail, Label } from "../../../ui/typography"
import { formatDateTime } from "../../../utils/format-date"
import { BLOCK_DELIVERY, type BlockDelivery } from "../block-delivery"
import { blockedBodyOf } from "../blocked-device-text"

export interface BlockDetection {
	at: Date
	delivery: BlockDelivery
}

interface Props {
	detection?: BlockDetection
	unsentCount?: number
}

// CAP-008-R03, CAP-008-S01, CAP-008-S03, E10, E48
export function BlockedDeviceScreen({ detection, unsentCount }: Props) {
	const strings = useTexts()
	const texts = strings.device.blockedRegistered
	const delivery = detection?.delivery ?? BLOCK_DELIVERY.REPORTED
	const advice = delivery === BLOCK_DELIVERY.REPORTED ? texts.reported.advice : texts.awaiting.advice
	return (
		<FeedbackScreen icon={<BlockedIcon />} heading={texts.heading} body={blockedBodyOf(strings, unsentCount)}>
			<Advice heading={advice.heading} body={advice.body} />
			<Detection detection={detection} delivery={texts[delivery].delivery} />
		</FeedbackScreen>
	)
}

function Advice({ heading, body }: { heading: string; body: string }) {
	return (
		<View className="mt-6 gap-1 rounded-control bg-secondary p-4">
			<Label>{heading}</Label>
			<Detail>{body}</Detail>
		</View>
	)
}

function Detection({ detection, delivery }: { detection: BlockDetection | undefined; delivery: string }) {
	const strings = useTexts()
	if (detection === undefined) {
		return null
	}
	const moment = formatDateTime(detection.at, strings.language)
	return <Detail className="mt-4">{`${strings.device.blockedRegistered.detected} ${moment} · ${delivery}`}</Detail>
}
