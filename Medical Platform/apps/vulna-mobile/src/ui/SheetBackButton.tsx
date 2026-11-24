import colors from "../styles/colors.json"
import { GLASS_LOOK, GlassAction } from "./GlassAction"
import { BackIcon } from "./icons/BackIcon"
import { SYSTEM_SYMBOL, SystemSymbol } from "./SystemSymbol"

interface Props {
	label: string
	onPress: () => void
}

// HIG-02, HIG-08, Vulna / Native / Sheet title bar
export function SheetBackButton({ label, onPress }: Props) {
	return (
		<GlassAction label={label} look={GLASS_LOOK.LIGHT} onPress={onPress}>
			<SystemSymbol
				name={SYSTEM_SYMBOL.BACK}
				tint={colors.foreground}
				fallback={<BackIcon color={colors.foreground} />}
			/>
		</GlassAction>
	)
}
