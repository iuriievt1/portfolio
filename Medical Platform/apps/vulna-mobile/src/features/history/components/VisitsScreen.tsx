import type { Encounter } from "../../../api/encounters"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { CalendarBlankIcon } from "../../../ui/icons/CalendarBlankIcon"
import { ICON_LOOK, ICON_LOOK_STYLE } from "../../../ui/icons/icon-look"
import { BrowseEmpty, BrowseScreen } from "../../patient/components/BrowseScreen"
import type { PagedContent } from "../../remote/hooks/use-paged-content"
import type { LoadState } from "../../remote/hooks/use-remote-content"
import type { PatientVisits } from "../hooks/use-patient-visits"
import { sectionRowsOf } from "../sections"
import { visitSectionsOf, visitSectionTitleOf } from "../visit-sections"
import { SectionedList } from "./SectionedList"
import { VisitHistoryRow } from "./VisitHistoryRow"

interface Props {
	patient: Patient
	state: LoadState<PagedContent<Encounter, PatientVisits>>
	onBack: () => void
	onRetry: () => void
	onMore: () => void
	onOpen: (visit: Encounter) => void
}

const EMPTY_ICON = ICON_LOOK_STYLE[ICON_LOOK.FEEDBACK]
// CAP-014-R24, E109, Figma 07 A.1, Figma 07 A.3
export function VisitsScreen({ patient, state, onBack, onRetry, onMore, onOpen }: Props) {
	const texts = useTexts()
	const history = texts.history
	return (
		<BrowseScreen
			title={history.title}
			patient={patient}
			state={state}
			serverErrorHeading={history.loadFailed}
			onBack={onBack}
			onRetry={onRetry}
		>
			{({ items, today, more }) =>
				items.length === 0 ? (
					<BrowseEmpty
						icon={<CalendarBlankIcon size={EMPTY_ICON.size} color={EMPTY_ICON.color} />}
						heading={history.empty.heading}
						body={history.empty.body}
					/>
				) : (
					<SectionedList
						rows={sectionRowsOf(
							visitSectionsOf(items, today),
							(section) => visitSectionTitleOf(section, texts),
							(visit: Encounter) => visit.encounter_id,
						)}
						more={more}
						onMore={onMore}
						renderItem={(visit) => <VisitHistoryRow visit={visit} onOpen={() => onOpen(visit)} />}
					/>
				)
			}
		</BrowseScreen>
	)
}
