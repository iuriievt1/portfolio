import { ScrollView, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import { Button } from "../../../ui/Button"
import { InsetDivider } from "../../../ui/Divider"
import { ChoiceListSkeleton } from "../../assessment/components/ChoiceListSkeleton"
import { ChoiceRow } from "../../assessment/components/ChoiceRow"
import type { CodeListItems } from "../../assessment/hooks/use-code-list-items"
import { StepScreen } from "../../capture/components/StepScreen"
import type { LoadState } from "../../remote/hooks/use-remote-content"

interface Props {
	patient: Patient
	choices: LoadState<CodeListItems>
	selectedCode: string | undefined
	hasCustomTitle: boolean
	isSaving: boolean
	onRetry: () => void
	onBack: () => void
	onSelect: (code: string) => void
	onCustom: () => void
	onContinue: (() => void) | undefined
}

// CAP-018-R15, CAP-017-R19, Figma 06 A.3, B.5, Vulna / Sheet / Choice step
export function DocumentTitleScreen({
	patient,
	choices,
	selectedCode,
	hasCustomTitle,
	isSaving,
	onRetry,
	onBack,
	onSelect,
	onCustom,
	onContinue,
}: Props) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	return (
		<StepScreen
			title={texts.scan.documentTitle.title}
			patient={patient}
			state={choices}
			serverErrorHeading={texts.capture.choice.loadFailed}
			skeleton={<ChoiceListSkeleton />}
			onRetry={onRetry}
			onBack={onBack}
		>
			{({ items }) => (
				<>
					<ScrollView className="flex-1" contentContainerClassName="pt-list pb-safe-gap-or-sheet">
						{items.map((item) => (
							<View key={item.code}>
								<ChoiceRow
									label={nameOf(item.names)}
									isSelected={item.code === selectedCode}
									badge={undefined}
									disabled={isSaving}
									onPress={() => onSelect(item.code)}
								/>
								<InsetDivider />
							</View>
						))}
						<ChoiceRow
							label={texts.scan.documentTitle.custom}
							isSelected={hasCustomTitle}
							badge={undefined}
							disabled={isSaving}
							onPress={onCustom}
						/>
						<InsetDivider />
					</ScrollView>
					{onContinue === undefined ? null : (
						<View className="px-screen pt-4 pb-safe-gap-or-sheet">
							<Button label={texts.scan.documentTitle.continue} onPress={onContinue} disabled={isSaving} />
						</View>
					)}
				</>
			)}
		</StepScreen>
	)
}
