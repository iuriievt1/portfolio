import { CLINICAL_DESCRIPTION_MAX_LENGTH } from "@ansora/contracts"
import { useState } from "react"
import { TextInput, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { Button } from "../../../ui/Button"
import { SheetHeader } from "../../../ui/SheetHeader"

interface Props {
	note: string
	isSaving: boolean
	onSave: (note: string) => void
	onClose: () => void
}

// CAP-017-R04, CAP-014-R14, D29
export function NoteSheet({ note, isSaving, onSave, onClose }: Props) {
	const texts = useTexts().capture.note
	const [text, setText] = useState(note)
	return (
		<View className="bg-card pb-safe-gap-or-6">
			<SheetHeader title={texts.title} closeLabel={texts.close} onClose={onClose} />
			<View className="gap-4 px-screen pt-4">
				<TextInput
					className="min-h-note rounded-field border border-field-border bg-field px-4 py-3 text-body text-foreground"
					value={text}
					onChangeText={setText}
					placeholder={texts.placeholder}
					placeholderTextColor={colors["muted-foreground"]}
					maxLength={CLINICAL_DESCRIPTION_MAX_LENGTH}
					multiline
					autoFocus
					textAlignVertical="top"
					editable={!isSaving}
				/>
				<Button label={texts.save} onPress={() => onSave(text)} disabled={isSaving} waiting={isSaving} />
			</View>
		</View>
	)
}
