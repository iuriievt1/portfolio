import { DOCUMENT_TITLE_TEXT_MAX_LENGTH } from "@ansora/contracts"
import { useState } from "react"
import { TextInput, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { Button } from "../../../ui/Button"
import { SheetHeader } from "../../../ui/SheetHeader"

interface Props {
	title: string
	isSaving: boolean
	onSave: (title: string) => void
	onClose: () => void
}

// CAP-018-R15
export function CustomTitleSheet({ title, isSaving, onSave, onClose }: Props) {
	const texts = useTexts().scan.customTitle
	const [text, setText] = useState(title)
	const canSave = text.trim() !== "" && !isSaving
	return (
		<View className="bg-card pb-safe-gap-or-6">
			<SheetHeader title={texts.title} closeLabel={texts.close} onClose={onClose} />
			<View className="gap-4 px-screen pt-4">
				<TextInput
					className="h-control rounded-field border border-field-border bg-field px-4 text-body text-foreground"
					value={text}
					onChangeText={setText}
					placeholder={texts.placeholder}
					placeholderTextColor={colors["muted-foreground"]}
					maxLength={DOCUMENT_TITLE_TEXT_MAX_LENGTH}
					autoFocus
					returnKeyType="done"
					onSubmitEditing={() => canSave && onSave(text)}
					editable={!isSaving}
				/>
				<Button label={texts.save} onPress={() => onSave(text)} disabled={!canSave} waiting={isSaving} />
			</View>
		</View>
	)
}
