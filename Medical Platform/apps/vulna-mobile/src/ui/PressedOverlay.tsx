import { View } from "react-native"

const OVERLAY = "absolute inset-0 hidden bg-foreground/10 group-active:flex"

export function PressedOverlay({ className }: { className?: string }) {
	return <View className={className === undefined ? OVERLAY : `${OVERLAY} ${className}`} />
}
