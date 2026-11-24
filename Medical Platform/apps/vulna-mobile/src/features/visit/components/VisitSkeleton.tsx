import { View } from "react-native"
import { InsetDivider } from "../../../ui/Divider"
import { SkeletonBar } from "../../../ui/Skeleton"

// E101, stavy-a-mikrocopy.md 4
export function VisitSkeleton() {
	return (
		<View className="pt-5" accessibilityState={{ busy: true }}>
			<RecordSkeleton title="w-skeleton-name" detail="w-skeleton-count" />
			<InsetDivider />
			<RecordSkeleton title="w-skeleton-name-short" detail="w-skeleton-detail-short" />
			<InsetDivider />
		</View>
	)
}

function RecordSkeleton({ title, detail }: { title: string; detail: string }) {
	return (
		<View className="min-h-14 flex-row items-center gap-3 px-screen py-3">
			<View className="h-11 w-11 items-center justify-center">
				<View className="h-category w-category rounded-full bg-secondary" />
			</View>
			<View className="flex-1 gap-2">
				<SkeletonBar className={`h-skeleton-line ${title}`} />
				<View className="flex-row items-center gap-2">
					<SkeletonBar className="h-skeleton-small w-skeleton-pill" />
					<SkeletonBar className={`h-skeleton-small ${detail}`} />
				</View>
			</View>
		</View>
	)
}
