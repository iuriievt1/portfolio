import { Fragment } from "react"
import { View } from "react-native"
import { Divider } from "../../../ui/Divider"
import { SkeletonBar } from "../../../ui/Skeleton"

const SECTION_VALUES = ["w-skeleton-name", "w-skeleton-detail", "w-skeleton-planned-short", "w-skeleton-name-short"]

// stavy-a-mikrocopy.md 4
export function SummarySkeleton() {
	return (
		<View className="px-screen pt-list" accessibilityState={{ busy: true }}>
			{SECTION_VALUES.map((value) => (
				<Fragment key={value}>
					<View className="gap-2 py-3">
						<SkeletonBar className="h-skeleton-small w-skeleton-pill" />
						<SkeletonBar className={`h-skeleton-line ${value}`} />
					</View>
					<Divider />
				</Fragment>
			))}
		</View>
	)
}
