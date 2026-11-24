import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { InsetDivider } from "../../../ui/Divider"
import { CalendarBlankIcon } from "../../../ui/icons/CalendarBlankIcon"
import { FileTextIcon } from "../../../ui/icons/FileTextIcon"
import { ICON_LOOK, ICON_LOOK_STYLE } from "../../../ui/icons/icon-look"
import { TimeIcon } from "../../../ui/icons/TimeIcon"
import { SkeletonBar } from "../../../ui/Skeleton"
import { SectionHeading } from "./SectionHeading"

const SECTION_ICON = ICON_LOOK_STYLE[ICON_LOOK.SECTION]

// E91, E90, clinical-workflow.yaml listRecentPatients
export function OverviewSkeleton({ withScheduled }: { withScheduled: boolean }) {
	const texts = useTexts().overview
	return (
		<View className="pt-4" accessibilityState={{ busy: true }}>
			<SectionHeading icon={<FileTextIcon {...SECTION_ICON} />} title={texts.started} />
			<View className="pt-2">
				<DraftSkeleton name="w-skeleton-name" detail="w-skeleton-detail" />
				<InsetDivider />
				<DraftSkeleton name="w-skeleton-name-short" detail="w-skeleton-detail-short" />
				<InsetDivider />
			</View>
			{withScheduled ? (
				<>
					<SectionHeading
						icon={<CalendarBlankIcon {...SECTION_ICON} />}
						title={texts.planned}
						value={texts.today}
						className="pt-8"
					/>
					<View className="pt-2">
						<PlannedSkeleton name="w-skeleton-planned" />
						<InsetDivider />
						<PlannedSkeleton name="w-skeleton-planned-short" />
						<InsetDivider />
					</View>
				</>
			) : (
				<>
					<SectionHeading icon={<TimeIcon {...SECTION_ICON} />} title={texts.recent} className="pt-8" />
					<View className="pt-2">
						<DraftSkeleton name="w-skeleton-name" detail="w-skeleton-detail-short" />
						<InsetDivider />
						<DraftSkeleton name="w-skeleton-name-short" detail="w-skeleton-detail-short" />
						<InsetDivider />
					</View>
				</>
			)}
		</View>
	)
}

function DraftSkeleton({ name, detail }: { name: string; detail: string }) {
	return (
		<View className="h-work-row flex-row items-center gap-3 px-screen">
			<View className="flex-1 gap-2">
				<SkeletonBar className={`h-skeleton-line ${name}`} />
				<SkeletonBar className={`h-skeleton-small ${detail}`} />
			</View>
			<SkeletonBar className="h-skeleton-small w-skeleton-birth" />
			<SkeletonBar className="h-skeleton-medium w-skeleton-caret" />
		</View>
	)
}

function PlannedSkeleton({ name }: { name: string }) {
	return (
		<View className="h-planned-row flex-row items-center gap-4 px-screen">
			<SkeletonBar className="h-skeleton-line w-skeleton-time" />
			<View className="flex-1 gap-2">
				<SkeletonBar className={`h-skeleton-line ${name}`} />
				<SkeletonBar className="h-skeleton-small w-skeleton-birth" />
			</View>
			<SkeletonBar className="h-skeleton-medium w-skeleton-caret" />
		</View>
	)
}
