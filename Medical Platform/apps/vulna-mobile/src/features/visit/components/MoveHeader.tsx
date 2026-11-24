import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { SheetBackButton } from "../../../ui/SheetBackButton"
import { VisitHeader } from "./VisitHeader"

interface Props {
	title: string
	patient: Patient
	onBack: () => void
}

// CAP-014-R25, CAP-013-R09, E117
export function MoveHeader({ title, patient, onBack }: Props) {
	const texts = useTexts()
	return (
		<VisitHeader
			title={title}
			patient={patient}
			leading={<SheetBackButton label={texts.move.back} onPress={onBack} />}
			trailing={undefined}
		/>
	)
}
