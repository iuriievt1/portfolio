import type { IntegrityBlock } from "@ansora/core-mobile"
import { useTexts } from "../../../i18n/language-store"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { BlockedIcon } from "../../../ui/icons/BlockedIcon"
import { deliveryOf } from "../block-delivery"
import { BlockedDeviceScreen } from "./BlockedDeviceScreen"

interface Props {
	block: IntegrityBlock
}

// CAP-008-R03, CAP-008-R13, CAP-008-S10, E10, E48, E60
export function IntegrityBlockScreen({ block }: Props) {
	const texts = useTexts().device.blocked
	if (!block.registered) {
		return <FeedbackScreen icon={<BlockedIcon />} heading={texts.heading} body={texts.body} />
	}
	return (
		<BlockedDeviceScreen
			detection={{ at: new Date(block.detectedAt), delivery: deliveryOf(block) }}
			unsentCount={block.unsentItems?.count}
		/>
	)
}
