import type { ReactNode } from "react"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { SheetBackButton } from "../../../ui/SheetBackButton"
import { VisitHeader } from "../../visit/components/VisitHeader"

interface Props {
	title: string
	patient: Patient
	leading?: ReactNode
	onBack: (() => void) | undefined
}

// CAP-015-R31, CAP-013-R09, Figma 05 A
export function StepHeader({ title, patient, leading, onBack }: Props) {
	const texts = useTexts().capture.step
	const back = onBack === undefined ? undefined : <SheetBackButton label={texts.back} onPress={onBack} />
	return <VisitHeader title={title} patient={patient} leading={leading ?? back} trailing={undefined} />
}
