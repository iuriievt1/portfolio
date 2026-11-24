import { View } from "react-native"
import { SkeletonBar } from "../../../ui/Skeleton"
import { ignore } from "../../../utils/ignore"
import { LocationFooter } from "./LocationFooter"

// E106, stavy-a-mikrocopy.md 4
export function LocationSkeleton() {
	return (
		<View className="flex-1" accessibilityState={{ busy: true }}>
			<View className="mt-4 flex-1 px-screen">
				<SkeletonBar className="h-full w-full" />
			</View>
			<LocationFooter hasChoice={false} isSaving={false} onContinue={ignore} />
		</View>
	)
}
