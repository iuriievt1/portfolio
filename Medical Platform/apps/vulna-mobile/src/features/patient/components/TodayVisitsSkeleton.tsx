import { View } from "react-native"
import { Divider } from "../../../ui/Divider"
import { SkeletonBar } from "../../../ui/Skeleton"

// E99
export function TodayVisitsSkeleton() {
	return (
		<View accessibilityState={{ busy: true }}>
			<VisitSkeleton />
			<Divider />
			<VisitSkeleton />
		</View>
	)
}

function VisitSkeleton() {
	return (
		<View className="h-16 flex-row items-center gap-3">
			<View className="flex-1 gap-2">
				<SkeletonBar className="h-skeleton-line w-skeleton-visit-time" />
				<View className="flex-row items-center gap-2">
					<SkeletonBar className="h-skeleton-line w-skeleton-pill" />
					<SkeletonBar className="h-skeleton-small w-skeleton-count" />
				</View>
			</View>
			<SkeletonBar className="h-skeleton-medium w-skeleton-pill" />
		</View>
	)
}
