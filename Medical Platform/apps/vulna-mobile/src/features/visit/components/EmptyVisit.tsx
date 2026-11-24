import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { ICON_LOOK, ICON_LOOK_STYLE } from "../../../ui/icons/icon-look"
import { PlusIcon } from "../../../ui/icons/PlusIcon"
import { StateMessage } from "../../../ui/StateMessage"

const FEEDBACK_ICON = ICON_LOOK_STYLE[ICON_LOOK.FEEDBACK]

// E100
export function EmptyVisit() {
	const texts = useTexts().visit.empty
	return (
		<View className="px-screen pt-visit-empty">
			<StateMessage icon={<PlusIcon {...FEEDBACK_ICON} />} heading={texts.heading} body={texts.body} />
		</View>
	)
}
