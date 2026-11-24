import type { CodeListItem } from "../../../api/code-lists"
import type { Patient } from "../../../api/patients"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { SheetCloseButton } from "../../../ui/SheetCloseButton"
import { fillText } from "../../../utils/fill-text"
import { ChoiceListScreen } from "../../assessment/components/ChoiceListScreen"
import type { CodeListChoices } from "../../assessment/hooks/use-code-list-items"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import { LOAD_STATE, type LoadState } from "../../remote/hooks/use-remote-content"
import { TYPE_CHANGE, type TypeChangeStep } from "../type-change"
import { codeNameOf } from "../wound-view"

interface Props {
	patient: Patient
	choices: LoadState<CodeListChoices>
	selectedCode: string
	step: TypeChangeStep
	onRetry: () => void
	onClose: () => void
	onSelect: (code: string, version: string) => void
	onConfirm: () => void
	onDismiss: () => void
}

// CAP-020-R21, CAP-017-R02, E122, Vulna / Sheet / Choice step, Figma 07 D.2, Figma 07 D.3
export function WoundTypeScreen({
	patient,
	choices,
	selectedCode,
	step,
	onRetry,
	onClose,
	onSelect,
	onConfirm,
	onDismiss,
}: Props) {
	const changeType = useTexts().wounds.changeType
	const isChanging = step.kind === TYPE_CHANGE.CHANGING
	return (
		<>
			<ChoiceListScreen
				title={changeType.title}
				patient={patient}
				choices={choices}
				selectedCode={selectedCode}
				badge={undefined}
				isSaving={isChanging}
				leading={<SheetCloseButton label={changeType.close} isEnabled={!isChanging} onPress={onClose} />}
				onRetry={onRetry}
				onBack={undefined}
				onSelect={(code) => {
					if (choices.kind === LOAD_STATE.READY) {
						onSelect(code, choices.version)
					}
				}}
			/>
			{choices.kind === LOAD_STATE.READY ? (
				<TypeChangeDialogs step={step} types={choices.all} onConfirm={onConfirm} onDismiss={onDismiss} />
			) : null}
		</>
	)
}

interface DialogProps {
	step: TypeChangeStep
	types: readonly CodeListItem[]
	onConfirm: () => void
	onDismiss: () => void
}

// CAP-020-R21, CAP-020-S26, CAP-002-R17, E29, E122
function TypeChangeDialogs({ step, types, onConfirm, onDismiss }: DialogProps) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const changeType = texts.wounds.changeType
	if (step.kind === TYPE_CHANGE.FAILED) {
		return (
			<RemoteFailureDialog
				failure={step.failure}
				serverErrorHeading={changeType.failed}
				closeLabel={changeType.failedClose}
				onClose={onDismiss}
			/>
		)
	}
	if (step.kind !== TYPE_CHANGE.CONFIRMING) {
		return null
	}
	const body = fillText(
		changeType.confirm.body,
		{
			previous: codeNameOf(types, step.previous, nameOf) ?? step.previous,
			next: codeNameOf(types, step.next, nameOf) ?? step.next,
		},
		texts.language,
	)
	return (
		<ConfirmDialog
			title={step.hasChangedMeanwhile ? changeType.confirm.conflictTitle : changeType.confirm.title}
			body={body}
			primary={{ label: changeType.confirm.change, onPress: onConfirm }}
			secondary={{ label: changeType.confirm.cancel, onPress: onDismiss }}
		/>
	)
}
