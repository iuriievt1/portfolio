import { ScrollView, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { Body } from "../../../ui/typography"
import { PatientFinder, type PatientIdentification } from "../../overview/components/PatientFinder"
import { MoveHeader } from "./MoveHeader"

interface Props {
	patient: Patient
	identification: PatientIdentification
	onBack: () => void
}

// CAP-014-R25, CAP-013-R02, CAP-013-R04, CHG-176, E117
export function MovePatientScreen({ patient, identification, onBack }: Props) {
	const texts = useTexts()
	return (
		<View className="flex-1 bg-background">
			<MoveHeader title={texts.move.title} patient={patient} onBack={onBack} />
			<PatientFinder identification={identification}>
				<ScrollView className="flex-1" contentContainerClassName="px-screen pt-5">
					<Body>{texts.move.findPatient}</Body>
				</ScrollView>
			</PatientFinder>
		</View>
	)
}
