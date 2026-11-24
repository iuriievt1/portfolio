import { View } from "react-native"
import { InsetDivider } from "../../../ui/Divider"
import { SkeletonBar } from "../../../ui/Skeleton"

const ROW_WIDTHS = ["w-skeleton-name", "w-skeleton-detail-short", "w-skeleton-planned", "w-skeleton-name-short"]

// stavy-a-mikrocopy.md 4
export function ChoiceListSkeleton() {
	return (
		<View className="pt-list" accessibilityState={{ busy: true }}>
			{ROW_WIDTHS.map((width) => (
				<View key={width}>
					<View className="px-screen py-choice">
						<SkeletonBar className={`h-skeleton-line ${width}`} />
					</View>
					<InsetDivider />
				</View>
			))}
		</View>
	)
}
