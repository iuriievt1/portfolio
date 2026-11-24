import type { ReactNode } from "react"
import { ScrollView, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import { InsetDivider } from "../../../ui/Divider"
import { StepScreen } from "../../capture/components/StepScreen"
import type { LoadState } from "../../remote/hooks/use-remote-content"
import type { CodeListItems } from "../hooks/use-code-list-items"
import type { ChoiceBadge } from "../types/choice-badge"
import { ChoiceListSkeleton } from "./ChoiceListSkeleton"
import { ChoiceRow } from "./ChoiceRow"

interface Props {
	title: string
	patient: Patient
	choices: LoadState<CodeListItems>
	selectedCode: string | undefined
	badge: ChoiceBadge | undefined
	isSaving: boolean
	leading?: ReactNode
	onRetry: () => void
	onBack: (() => void) | undefined
	onSelect: (code: string) => void
}

// CAP-017-R19, CAP-015-R31, CAP-015-R26, Vulna / Sheet / Choice step
export function ChoiceListScreen({
	title,
	patient,
	choices,
	selectedCode,
	badge,
	isSaving,
	leading,
	onRetry,
	onBack,
	onSelect,
}: Props) {
	const texts = useTexts().capture.choice
	const nameOf = useLocalizedName()
	return (
		<StepScreen
			title={title}
			patient={patient}
			state={choices}
			serverErrorHeading={texts.loadFailed}
			skeleton={<ChoiceListSkeleton />}
			leading={leading}
			onRetry={onRetry}
			onBack={onBack}
		>
			{({ items }) => (
				<ScrollView className="flex-1" contentContainerClassName="pt-list pb-safe-gap-or-sheet">
					{items.map((item) => (
						<View key={item.code}>
							<ChoiceRow
								label={nameOf(item.names)}
								isSelected={item.code === selectedCode}
								badge={item.code === badge?.code ? badge.text : undefined}
								disabled={isSaving}
								onPress={() => onSelect(item.code)}
							/>
							<InsetDivider />
						</View>
					))}
				</ScrollView>
			)}
		</StepScreen>
	)
}
