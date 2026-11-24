import { View } from "react-native"
import type { CodeListSet } from "../../../api/code-lists"
import type { Finding } from "../../../api/findings"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import { OpenRow } from "../../../ui/OpenRow"
import { Detail, Label } from "../../../ui/typography"
import { clinicalSteps } from "../../assessment/instance-clinical-steps"
import { RemoteThumbnail } from "../../record/components/RemoteThumbnail"
import { useImageThumbnail } from "../../record/hooks/use-remote-thumbnail"
import { codeNameOf, typeAndPhaseOf, woundPeriodOf, woundTitleOf } from "../wound-view"

interface Props {
	finding: Finding
	codeLists: CodeListSet
	onOpen: () => void
}

// CAP-020-R01, CAP-020-R20, CAP-017-R16, Vulna / Patient / Wound row
export function WoundRow({ finding, codeLists, onOpen }: Props) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const cover = useImageThumbnail(finding.cover_image_id ?? undefined)
	const assessment = typeAndPhaseOf(
		codeNameOf(codeLists.wound_types, finding.wound_type_code, nameOf),
		codeNameOf(codeLists.healing_phases, finding.last_assessment?.healing_phase_code, nameOf),
		clinicalSteps(),
		texts,
	)
	return (
		<OpenRow onPress={onOpen}>
			<RemoteThumbnail state={cover} className="h-20 w-20 rounded-xl" placeholderClassName="bg-secondary" />
			<View className="flex-1 gap-1">
				<Label numberOfLines={2}>
					{woundTitleOf(finding.last_body_site, codeLists.body_diagram.regions, nameOf, texts)}
				</Label>
				{assessment === undefined ? null : <Detail>{assessment}</Detail>}
				<Detail>{woundPeriodOf(finding, texts)}</Detail>
			</View>
		</OpenRow>
	)
}
