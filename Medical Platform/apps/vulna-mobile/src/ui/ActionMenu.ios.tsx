import { Button, Host, Image, Menu, Text } from "@expo/ui/swift-ui"
import { accessibilityLabel, background, disabled, frame, menuIndicator, shapes } from "@expo/ui/swift-ui/modifiers"
import {
	type ActionMenuProps,
	MENU_SYMBOL,
	MENU_SYMBOL_SIZE,
	MENU_TRIGGER_SIZE,
	MENU_TRIGGER_STYLE,
	type MenuAction,
} from "./action-menu"

const TRIGGER_FRAME = frame({ width: MENU_TRIGGER_SIZE, height: MENU_TRIGGER_SIZE })

// HIG-09, Vulna / Native / Pull-down menu
export function ActionMenu({ label, look, actions }: ActionMenuProps) {
	const trigger = MENU_TRIGGER_STYLE[look]
	const surface = trigger.surface === undefined ? [] : [background(trigger.surface, shapes.circle())]
	return (
		<Host matchContents>
			<Menu
				label={
					<Image
						systemName={MENU_SYMBOL.MORE}
						size={MENU_SYMBOL_SIZE}
						color={trigger.color}
						modifiers={[TRIGGER_FRAME, ...surface, accessibilityLabel(label)]}
					/>
				}
				modifiers={[menuIndicator("hidden")]}
			>
				{actions.map((action) => (
					<MenuItem key={action.key} action={action} />
				))}
			</Menu>
		</Host>
	)
}

function MenuItem({ action }: { action: MenuAction }) {
	if (action.unavailableReason !== undefined) {
		return (
			<Button modifiers={[disabled(true)]}>
				<Text>{action.label}</Text>
				<Text>{action.unavailableReason}</Text>
				<Image systemName={action.symbol} />
			</Button>
		)
	}
	return (
		<Button
			label={action.label}
			systemImage={action.symbol}
			role={action.isDestructive ? "destructive" : "default"}
			onPress={action.onSelect}
		/>
	)
}
