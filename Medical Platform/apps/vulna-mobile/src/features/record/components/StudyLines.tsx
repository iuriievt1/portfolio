import { useTexts } from "../../../i18n/language-store"
import { Detail, type TextTone } from "../../../ui/typography"
import { fillText } from "../../../utils/fill-text"

interface Props {
	studyInstanceUid: string | null | undefined
	accessionNumber: string | null | undefined
	tone?: TextTone
}

// CAP-020-R07, CAP-020-R15, Q-034
export function StudyLines({ studyInstanceUid, accessionNumber, tone }: Props) {
	const texts = useTexts()
	return (
		<>
			{studyInstanceUid === null || studyInstanceUid === undefined ? null : (
				<Detail tone={tone} selectable>
					{fillText(texts.record.study, { uid: studyInstanceUid }, texts.language)}
				</Detail>
			)}
			{accessionNumber === null || accessionNumber === undefined ? null : (
				<Detail tone={tone} selectable>
					{fillText(texts.record.accession, { number: accessionNumber }, texts.language)}
				</Detail>
			)}
		</>
	)
}
