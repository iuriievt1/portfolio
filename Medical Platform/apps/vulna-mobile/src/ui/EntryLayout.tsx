import type { ReactNode } from "react"
import { ScrollView, View } from "react-native"
import { BUTTON_STYLE, Button } from "./Button"

export interface EntryAction {
	label: string
	onPress: () => void
	waiting?: boolean
}

export const ENTRY_OFFSET = {
	ENTRY: "entry",
	FEEDBACK: "feedback",
} as const

export type EntryOffset = (typeof ENTRY_OFFSET)[keyof typeof ENTRY_OFFSET]

interface Props {
	action?: EntryAction
	secondary?: EntryAction
	offset?: EntryOffset
	children: ReactNode
}

export const ENTRY_COLUMN = "w-full max-w-entry self-center px-screen"

const TOP: Record<EntryOffset, string> = {
	[ENTRY_OFFSET.ENTRY]: "pt-safe-offset-entry",
	[ENTRY_OFFSET.FEEDBACK]: "pt-safe-offset-feedback",
}

export function EntryLayout({ action, secondary, offset = ENTRY_OFFSET.ENTRY, children }: Props) {
	return (
		<View className="flex-1 bg-background">
			<ScrollView contentContainerClassName="grow items-center">
				<View className={`${ENTRY_COLUMN} ${TOP[offset]} pb-6`}>{children}</View>
			</ScrollView>
			<Actions action={action} secondary={secondary} />
		</View>
	)
}

function Actions({ action, secondary }: { action: EntryAction | undefined; secondary: EntryAction | undefined }) {
	if (action === undefined && secondary === undefined) {
		return null
	}
	return (
		<View className={`${ENTRY_COLUMN} gap-3 pb-safe-gap-or-6`}>
			{action === undefined ? null : <Button label={action.label} onPress={action.onPress} waiting={action.waiting} />}
			{secondary === undefined ? null : (
				<Button
					label={secondary.label}
					onPress={secondary.onPress}
					style={BUTTON_STYLE.SECONDARY}
					waiting={secondary.waiting}
				/>
			)}
		</View>
	)
}
