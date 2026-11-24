import { View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { SexSymbol } from "../../../ui/icons/SexSymbol"
import { Caption, TEXT_TONE } from "../../../ui/typography"
import { patientNumberOf, symbolSexOf } from "../patient-identity"

// CAP-013-R09, CHG-176, DESIGN.md 12.2
export function PatientLine({ patient, onDark = false }: { patient: Patient; onDark?: boolean }) {
	const texts = useTexts()
	const sex = symbolSexOf(patient.sex)
	const tone = onDark ? TEXT_TONE.ON_BRAND : TEXT_TONE.MUTED
	return (
		<View className={`flex-row items-center gap-1 ${onDark ? "opacity-on-dark" : ""}`}>
			{sex === undefined ? null : (
				<View accessible accessibilityLabel={texts.patientIdentity.sex[sex]}>
					<SexSymbol sex={sex} onDark={onDark} />
				</View>
			)}
			<Caption tone={tone}>{patientNumberOf(patient)}</Caption>
		</View>
	)
}
