import { Column, DropdownMenu, DropdownMenuItem, Host, RNHostView, Text } from "@expo/ui/jetpack-compose"
import { SymbolView } from "expo-symbols"
import { useState } from "react"
import { Pressable, View } from "react-native"
import colors from "../styles/colors.json"
import {
	type ActionMenuProps,
	MENU_SYMBOL,
	MENU_SYMBOL_SIZE,
	MENU_TRIGGER_SIZE,
	MENU_TRIGGER_STYLE,
	type MenuAction,
	type MenuLook,
} from "./action-menu"
import { MoreIcon } from "./icons/MoreIcon"

const TRIGGER_BOX = { width: MENU_TRIGGER_SIZE, height: MENU_TRIGGER_SIZE }
const DESTRUCTIVE_TEXT = { textColor: colors.destructive }
const REASON_STYLE = { typography: "bodySmall" } as const

// HIG-09, Vulna / Native / Pull-down menu
export function ActionMenu({ label, look, actions }: ActionMenuProps) {
	const [isOpen, setOpen] = useState(false)
	const choose = (action: MenuAction) => {
		setOpen(false)
		action.onSelect()
	}
	return (
		<Host matchContents>
			<DropdownMenu expanded={isOpen} onDismissRequest={() => setOpen(false)}>
				<DropdownMenu.Trigger>
					<RNHostView matchContents>
						<MenuTrigger label={label} look={look} onPress={() => setOpen(true)} />
					</RNHostView>
				</DropdownMenu.Trigger>
				<DropdownMenu.Items>
					{actions.map((action) => (
						<DropdownMenuItem
							key={action.key}
							enabled={action.unavailableReason === undefined}
							elementColors={action.isDestructive ? DESTRUCTIVE_TEXT : undefined}
							onClick={() => choose(action)}
						>
							<DropdownMenuItem.Text>
								<Column>
									<Text>{action.label}</Text>
									{action.unavailableReason === undefined ? null : (
										<Text style={REASON_STYLE}>{action.unavailableReason}</Text>
									)}
								</Column>
							</DropdownMenuItem.Text>
						</DropdownMenuItem>
					))}
				</DropdownMenu.Items>
			</DropdownMenu>
		</Host>
	)
}

function MenuTrigger({ label, look, onPress }: { label: string; look: MenuLook; onPress: () => void }) {
	const trigger = MENU_TRIGGER_STYLE[look]
	return (
		<Pressable
			className="group items-center justify-center rounded-full"
			style={[TRIGGER_BOX, trigger.surface === undefined ? undefined : { backgroundColor: trigger.surface }]}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
		>
			<View className="absolute inset-0 hidden rounded-full bg-foreground/10 group-active:flex" />
			<SymbolView
				name={MENU_SYMBOL.MORE}
				size={MENU_SYMBOL_SIZE}
				tintColor={trigger.color}
				fallback={<MoreIcon color={trigger.color} />}
			/>
		</Pressable>
	)
}
