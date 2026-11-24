import { useState } from "react"
import { type LayoutChangeEvent, View } from "react-native"
import Animated, { FadeIn, FadeOut } from "react-native-reanimated"
import type { Patient } from "../../../api/patients"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import { ignore } from "../../../utils/ignore"
import { WOUND_CHOICE, type WoundChoice } from "../../capture/capture-session"
import { StepScreen } from "../../capture/components/StepScreen"
import type { LoadState } from "../../remote/hooks/use-remote-content"
import { woundPlaceOf } from "../body-site-text"
import { type ChosenWound, chosenWoundTitleOf } from "../chosen-wound"
import type { EarlierPhoto } from "../earlier-photos"
import { useEarlierPhotos } from "../hooks/use-earlier-photos"
import { useLargestHeight } from "../hooks/use-largest-height"
import type { LocationData } from "../hooks/use-location-data"
import { useLocationStep } from "../hooks/use-location-step"
import { FADE_IN, FADE_IN_DELAY, FADE_OUT } from "../map-transition"
import { type Area, oneViewReserveOf } from "../wound-map-layout"
import { LocationDescription } from "./LocationDescription"
import { LocationFooter } from "./LocationFooter"
import { LocationMap } from "./LocationMap"
import { LocationSkeleton } from "./LocationSkeleton"

interface Props {
	acquisitionId: string
	patient: Patient
	data: LoadState<LocationData>
	isSaving: boolean
	onRetry: () => void
	onBack: () => void
	onContinue: (chosen: WoundChoice) => void
	onOpenEarlier: (findingId: string, imageId: string) => void
}

const DESCRIPTION_ENTERING = FadeIn.delay(FADE_IN_DELAY).duration(FADE_IN.duration)
const DESCRIPTION_EXITING = FadeOut.duration(FADE_OUT.duration)
const PROBE_LINE = "\u00a0"
const NO_PHOTOS: readonly EarlierPhoto[] = []

interface ContentProps {
	acquisitionId: string
	data: LocationData
	isSaving: boolean
	onContinue: (chosen: WoundChoice) => void
	onOpenEarlier: (findingId: string, imageId: string) => void
}

// CAP-015-R31, CAP-016-R17, E106
export function LocationScreen({
	acquisitionId,
	patient,
	data,
	isSaving,
	onRetry,
	onBack,
	onContinue,
	onOpenEarlier,
}: Props) {
	const texts = useTexts().capture.location
	return (
		<StepScreen
			title={texts.title}
			patient={patient}
			state={data}
			serverErrorHeading={texts.loadFailed}
			skeleton={<LocationSkeleton />}
			onRetry={onRetry}
			onBack={onBack}
		>
			{(loaded) => (
				<LocationContent
					acquisitionId={acquisitionId}
					data={loaded}
					isSaving={isSaving}
					onContinue={onContinue}
					onOpenEarlier={onOpenEarlier}
				/>
			)}
		</StepScreen>
	)
}

function LocationContent({ acquisitionId, data, isSaving, onContinue, onOpenEarlier }: ContentProps) {
	const texts = useTexts()
	const step = useLocationStep(acquisitionId, data)
	const nameOf = useLocalizedName()
	const chosenFindingId = step.selection?.kind === WOUND_CHOICE.EXISTING ? step.selection.finding.finding_id : undefined
	const earlierPhotos = useEarlierPhotos(chosenFindingId)
	const oneViewReserve = useLargestHeight()
	const [area, setArea] = useState<Area | undefined>(undefined)
	const hasPhotoRow = chosenFindingId !== undefined && earlierPhotos.length > 0
	const chosen: ChosenWound | undefined =
		step.selection === undefined
			? undefined
			: {
					title: chosenWoundTitleOf(step.selection, texts),
					...woundPlaceOf(step.selection.bodySite, data.regions, nameOf, texts),
				}

	const measureArea = (event: LayoutChangeEvent) => {
		const { width, height } = event.nativeEvent.layout
		setArea({ width, height })
	}

	// CAP-016-R17, CAP-015-R32
	const measureDescription = (event: LayoutChangeEvent) => {
		oneViewReserve.record(oneViewReserveOf(event.nativeEvent.layout.height, hasPhotoRow))
	}

	// CAP-021-R29
	const proceed = async () => {
		const settled = await step.settle()
		if (settled !== undefined) {
			onContinue(settled)
		}
	}

	return (
		<>
			<View className="mt-4 flex-1" onLayout={measureArea}>
				{area === undefined ? null : (
					<LocationMap
						area={area}
						oneViewReserve={oneViewReserve.height}
						drawing={data.drawing}
						shownDrawing={step.shownDrawing}
						focusedView={step.focusedView}
						wounds={data.wounds}
						selection={step.selection}
						onMark={step.markAt}
						onChooseWound={step.chooseFinding}
					/>
				)}
				<ReserveProbe onMeasure={oneViewReserve.record} />
				{chosen === undefined ? null : (
					<Animated.View
						className="absolute right-0 bottom-0 left-0 bg-background px-screen pt-3"
						entering={DESCRIPTION_ENTERING}
						exiting={DESCRIPTION_EXITING}
						onLayout={measureDescription}
					>
						<LocationDescription
							chosen={chosen}
							earlierPhotos={earlierPhotos}
							onClear={step.clear}
							onOpenEarlier={(imageId) => chosenFindingId !== undefined && onOpenEarlier(chosenFindingId, imageId)}
						/>
					</Animated.View>
				)}
			</View>
			<LocationFooter hasChoice={step.selection !== undefined} isSaving={isSaving} onContinue={() => void proceed()} />
		</>
	)
}

// CAP-016-R17, CAP-015-R32
function ReserveProbe({ onMeasure }: { onMeasure: (height: number) => void }) {
	const texts = useTexts().capture.location
	const probe: ChosenWound = { title: texts.newWound, region: PROBE_LINE, detail: PROBE_LINE }
	return (
		<View
			className="absolute right-0 bottom-0 left-0 px-screen pt-3 opacity-0"
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			onLayout={(event) => onMeasure(oneViewReserveOf(event.nativeEvent.layout.height, false))}
		>
			<LocationDescription chosen={probe} earlierPhotos={NO_PHOTOS} onClear={ignore} onOpenEarlier={ignore} />
		</View>
	)
}
