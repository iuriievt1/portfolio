import { Pressable, View } from "react-native"
import { useInterfaceLanguage, useSelectableLanguages, useTexts } from "../../../i18n/language-store"
import { languageNameOf } from "../../../i18n/texts"
import colors from "../../../styles/colors.json"
import { Notice } from "../../../ui/Notice"
import { SPINNER_SIZE, Spinner } from "../../../ui/Spinner"
import { Detail, Label } from "../../../ui/typography"
import { useLanguageChoice } from "../hooks/use-language-choice"
import { acceptsChoice, LANGUAGE_CHOICE } from "../language-choice"

// CAP-015-R25, CAP-015-S31
export function LanguageSection() {
	const texts = useTexts().settings.language
	const current = useInterfaceLanguage()
	const languages = useSelectableLanguages()
	const { choice, choose } = useLanguageChoice()
	const choosable = acceptsChoice(choice)

	return (
		<View className="gap-3">
			<View className="gap-1">
				<Label>{texts.title}</Label>
				<Detail>{texts.intro}</Detail>
			</View>
			{choice.kind === LANGUAGE_CHOICE.OFFLINE ? (
				<Notice
					heading={texts.offline.heading}
					body={texts.offline.body}
					action={{ label: texts.offline.action, onPress: () => void choose(choice.language) }}
				/>
			) : null}
			{choice.kind === LANGUAGE_CHOICE.UNSUPPORTED ? <Notice heading={texts.unsupported} /> : null}
			<View
				className="overflow-hidden rounded-control border border-border"
				accessibilityRole="radiogroup"
				accessibilityLabel={texts.title}
			>
				{languages.map((language, index) => (
					<LanguageRow
						key={language}
						language={language}
						selected={language === current}
						saving={choice.kind === LANGUAGE_CHOICE.SAVING && choice.language === language}
						enabled={choosable}
						divided={index > 0}
						selectedLabel={texts.selected}
						onPress={() => {
							if (language !== current) {
								void choose(language)
							}
						}}
					/>
				))}
			</View>
		</View>
	)
}

interface RowProps {
	language: string
	selected: boolean
	saving: boolean
	enabled: boolean
	divided: boolean
	selectedLabel: string
	onPress: () => void
}

function LanguageRow({ language, selected, saving, enabled, divided, selectedLabel, onPress }: RowProps) {
	return (
		<Pressable
			className={`group flex-row items-center gap-3 bg-card px-4 py-row ${divided ? "border-t border-border" : ""} ${enabled ? "" : "opacity-dim"}`}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected, disabled: !enabled, busy: saving }}
			disabled={!enabled}
			onPress={onPress}
		>
			<View className="absolute inset-0 hidden bg-foreground/10 group-active:flex" pointerEvents="none" />
			<Label className="flex-1" accessibilityLanguage={language}>
				{languageNameOf(language)}
			</Label>
			{saving ? <Spinner size={SPINNER_SIZE.CONTROL} color={colors.primary} /> : null}
			{selected ? <Detail className="text-primary">{selectedLabel}</Detail> : null}
		</Pressable>
	)
}
