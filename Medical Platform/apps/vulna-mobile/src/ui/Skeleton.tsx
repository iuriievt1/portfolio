import { View } from "react-native"

export function SkeletonBar({ className }: { className: string }) {
	return <View className={`rounded-badge bg-secondary ${className}`} />
}
