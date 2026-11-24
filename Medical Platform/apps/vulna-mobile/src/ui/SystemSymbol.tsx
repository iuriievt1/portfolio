import { SymbolView } from "expo-symbols"
import type { ReactNode } from "react"
import colors from "../styles/colors.json"

export const SYSTEM_SYMBOL = {
	BACK: "chevron.left",
	LOCK: "lock.fill",
	SETTINGS: "gearshape.fill",
} as const

type SystemSymbolName = (typeof SYSTEM_SYMBOL)[keyof typeof SYSTEM_SYMBOL]

const SIZE = 17

interface Props {
	name: SystemSymbolName
	fallback: ReactNode
	tint?: string
}

// FIG-20, HIG-08
export function SystemSymbol({ name, fallback, tint = colors["primary-foreground"] }: Props) {
	return <SymbolView name={name} size={SIZE} weight="medium" tintColor={tint} fallback={fallback} />
}
