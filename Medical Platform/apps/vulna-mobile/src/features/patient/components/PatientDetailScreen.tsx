import { Fragment } from "react"
import { ScrollView, View } from "react-native"
import type { Encounter } from "../../../api/encounters"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { BrandScreen } from "../../../ui/Brand"
import { Button } from "../../../ui/Button"
import { Divider, InsetDivider } from "../../../ui/Divider"
import { BandaidsIcon } from "../../../ui/icons/BandaidsIcon"
import { CalendarBlankIcon } from "../../../ui/icons/CalendarBlankIcon"
import { FileTextIcon } from "../../../ui/icons/FileTextIcon"
import { PlusIcon } from "../../../ui/icons/PlusIcon"
import { PanelHairline } from "../../../ui/PanelHairline"
import { RemoteFailureState } from "../../remote/components/RemoteFailureState"
import { LOAD_STATE } from "../../remote/hooks/use-remote-content"
import type { TodayVisitsState } from "../hooks/use-today-visits"
import { patientNumberOf } from "../patient-identity"
import { CategoryRow } from "./CategoryRow"
import { PatientHeader } from "./PatientHeader"
import { TodayVisitRow } from "./TodayVisitRow"
import { TodayVisitsSkeleton } from "./TodayVisitsSkeleton"

export interface PatientDocumentation {
	onVisits: () => void
	onWounds: () => void
	onDocuments: () => void
}

interface Props {
	patient: Patient
	today: TodayVisitsState
	documentation: PatientDocumentation | undefined
	onBack: () => void
	onRetry: () => void
	onOpenVisit: (visit: Encounter) => void
	onNewVisit: () => void
}

// CAP-013-R19, CAP-014-R19, CHG-176, E98, E99
export function PatientDetailScreen({
	patient,
	today,
	documentation,
	onBack,
	onRetry,
	onOpenVisit,
	onNewVisit,
}: Props) {
	const texts = useTexts()
	return (
		<BrandScreen>
			<PatientHeader title={patientNumberOf(patient)} subtitle={undefined} onBack={onBack} />
			<View className="flex-1 rounded-t-sheet bg-background">
				{today.kind === LOAD_STATE.FAILED ? (
					<RemoteFailureState failure={today.failure} serverErrorHeading={texts.patient.loadFailed} onRetry={onRetry} />
				) : (
					<>
						<ScrollView contentContainerClassName="grow pt-5">
							{documentation === undefined ? null : <Documentation documentation={documentation} />}
						</ScrollView>
						<View className="rounded-t-sheet bg-card px-screen pt-3 pb-safe-gap-or-4">
							<PanelHairline />
							<TodayVisits today={today} onOpenVisit={onOpenVisit} />
							<Button label={texts.patient.newVisit} icon={<PlusIcon />} onPress={onNewVisit} />
						</View>
					</>
				)}
			</View>
		</BrandScreen>
	)
}

function Documentation({ documentation }: { documentation: PatientDocumentation }) {
	const texts = useTexts().patient
	return (
		<>
			<CategoryRow
				icon={<CalendarBlankIcon />}
				tint="bg-category-visit"
				title={texts.visits}
				onPress={documentation.onVisits}
			/>
			<InsetDivider />
			<CategoryRow
				icon={<BandaidsIcon />}
				tint="bg-category-wound"
				title={texts.wounds}
				onPress={documentation.onWounds}
			/>
			<InsetDivider />
			<CategoryRow
				icon={<FileTextIcon />}
				tint="bg-status-info"
				title={texts.documents}
				onPress={documentation.onDocuments}
			/>
			<InsetDivider />
		</>
	)
}

function TodayVisits({ today, onOpenVisit }: { today: TodayVisitsState; onOpenVisit: (visit: Encounter) => void }) {
	if (today.kind === LOAD_STATE.LOADING) {
		return (
			<View className="pb-2">
				<TodayVisitsSkeleton />
			</View>
		)
	}
	if (today.kind !== LOAD_STATE.READY || today.visits.length === 0) {
		return null
	}
	return (
		<View className="pb-2">
			{today.visits.map((visit, index) => (
				<Fragment key={visit.encounter_id}>
					{index > 0 ? <Divider /> : null}
					<TodayVisitRow visit={visit} action={undefined} onOpen={() => onOpenVisit(visit)} />
				</Fragment>
			))}
		</View>
	)
}
