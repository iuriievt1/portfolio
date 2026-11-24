import { View } from "react-native"
import { BUTTON_STYLE, Button } from "./Button"
import type { EntryAction } from "./EntryLayout"
import { Detail, Label } from "./typography"

interface Props {
	heading: string
	body?: string
	action?: EntryAction
}

export function Notice({ heading, body, action }: Props) {
	return (
		<View className="gap-1 rounded-control bg-status-warn px-4 py-3" accessibilityRole="alert">
			<Label className="text-status-warn-foreground">{heading}</Label>
			{body === undefined ? null : <Detail className="text-status-warn-foreground">{body}</Detail>}
			{action === undefined ? null : (
				<View className="-ml-4 items-start">
					<Button label={action.label} onPress={action.onPress} style={BUTTON_STYLE.PLAIN} waiting={action.waiting} />
				</View>
			)}
		</View>
	)
}
