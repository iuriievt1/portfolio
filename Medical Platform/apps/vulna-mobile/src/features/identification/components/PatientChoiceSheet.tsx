import { PATIENT_IDENTIFICATION_METHOD } from "@ansora/contracts"
import { ScrollView, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { InsetDivider } from "../../../ui/Divider"
import { SheetHeader } from "../../../ui/SheetHeader"
import { Body } from "../../../ui/typography"
import type { MatchingPatients } from "../matching-patients"
import { matchIssuerOf } from "../patient-match"
import { MatchRow } from "./MatchRow"

interface Props {
	matches: MatchingPatients
	onPatient: (patient: Patient) => void
	onClose: () => void
}

// CAP-013-R10, CAP-013-R12, CAP-013-S19, CHG-176, E116
export function PatientChoiceSheet({ matches, onPatient, onClose }: Props) {
	const texts = useTexts()
	const choice = texts.patient.matches
	return (
		<View className="flex-1 bg-card">
			<SheetHeader title={choice.title} closeLabel={choice.close} onClose={onClose} />
			<ScrollView contentContainerClassName="pt-4 pb-safe-gap-or-6">
				<Body className="px-screen pb-2">
					{matches.method === PATIENT_IDENTIFICATION_METHOD.CODE ? choice.code : choice.tag}
				</Body>
				{matches.patients.map((patient) => (
					<View key={patient.patient_id}>
						<MatchRow
							identifier={matches.identifier.value}
							issuer={matchIssuerOf(patient, matches.identifier)}
							onPress={() => onPatient(patient)}
						/>
						<InsetDivider />
					</View>
				))}
			</ScrollView>
		</View>
	)
}
