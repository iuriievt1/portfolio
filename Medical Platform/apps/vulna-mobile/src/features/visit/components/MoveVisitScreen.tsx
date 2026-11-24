import { Fragment, useState } from "react"
import { type LayoutChangeEvent, ScrollView, View } from "react-native"
import type { Encounter } from "../../../api/encounters"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { Button } from "../../../ui/Button"
import { Divider } from "../../../ui/Divider"
import { Fog } from "../../../ui/Fog"
import { PlusIcon } from "../../../ui/icons/PlusIcon"
import { Body } from "../../../ui/typography"
import { TodayVisitRow } from "../../patient/components/TodayVisitRow"
import { TodayVisitsSkeleton } from "../../patient/components/TodayVisitsSkeleton"
import type { TodayVisitsState } from "../../patient/hooks/use-today-visits"
import { RemoteFailureState } from "../../remote/components/RemoteFailureState"
import { LOAD_STATE } from "../../remote/hooks/use-remote-content"
import { targetVisitsOf } from "../move-targets"
import { MoveHeader } from "./MoveHeader"

interface Props {
	patient: Patient
	visits: TodayVisitsState
	sourceEncounterId: string | undefined
	isMovingToNewVisit: boolean
	onBack: () => void
	onRetry: () => void
	onVisit: (visit: Encounter) => void
	onNewVisit: () => void
}

// CAP-014-R05, CAP-014-R12, CAP-014-R25, E117
export function MoveVisitScreen({
	patient,
	visits,
	sourceEncounterId,
	isMovingToNewVisit,
	onBack,
	onRetry,
	onVisit,
	onNewVisit,
}: Props) {
	const texts = useTexts()
	const [panelHeight, setPanelHeight] = useState(0)
	const measurePanel = (event: LayoutChangeEvent) => setPanelHeight(event.nativeEvent.layout.height)
	return (
		<View className="flex-1 bg-background">
			<MoveHeader title={texts.move.chooseVisit} patient={patient} onBack={onBack} />
			{visits.kind === LOAD_STATE.FAILED ? (
				<RemoteFailureState failure={visits.failure} serverErrorHeading={texts.move.loadFailed} onRetry={onRetry} />
			) : (
				<>
					<ScrollView contentContainerClassName="px-screen pt-5" contentContainerStyle={{ paddingBottom: panelHeight }}>
						<TargetVisits visits={visits} sourceEncounterId={sourceEncounterId} onVisit={onVisit} />
					</ScrollView>
					<View className="absolute right-0 bottom-0 left-0" onLayout={measurePanel}>
						<Fog />
						<View className="bg-background px-screen pb-safe-gap-or-sheet">
							<Button
								label={texts.move.newVisit}
								icon={<PlusIcon />}
								onPress={onNewVisit}
								waiting={isMovingToNewVisit}
							/>
						</View>
					</View>
				</>
			)}
		</View>
	)
}

interface TargetVisitsProps {
	visits: TodayVisitsState
	sourceEncounterId: string | undefined
	onVisit: (visit: Encounter) => void
}

function TargetVisits({ visits, sourceEncounterId, onVisit }: TargetVisitsProps) {
	const texts = useTexts()
	if (visits.kind === LOAD_STATE.LOADING) {
		return <TodayVisitsSkeleton />
	}
	if (visits.kind !== LOAD_STATE.READY) {
		return null
	}
	const targets = targetVisitsOf(visits.visits, sourceEncounterId)
	if (targets.length === 0) {
		return <Body>{texts.move.noOtherVisit}</Body>
	}
	return (
		<>
			{targets.map((visit, index) => (
				<Fragment key={visit.encounter_id}>
					{index > 0 ? <Divider /> : null}
					<TodayVisitRow visit={visit} action={texts.move.choose} onOpen={() => onVisit(visit)} />
				</Fragment>
			))}
		</>
	)
}
