import { Pressable } from "react-native"
import { CheckIcon } from "../../../ui/icons/CheckIcon"
import { OpenIcon } from "../../../ui/icons/OpenIcon"
import { PressedOverlay } from "../../../ui/PressedOverlay"
import { PILL_TONE } from "../../../ui/pill-tone"
import { StatusPill } from "../../../ui/StatusPill"
import { Body, Label, TEXT_TONE } from "../../../ui/typography"

interface Props {
	label: string
	isSelected: boolean
	badge: string | undefined
	disabled: boolean
	onPress: () => void
}

// CAP-017-R19, CAP-017-S11, Vulna / Form / Next choice row
export function ChoiceRow({ label, isSelected, badge, disabled, onPress }: Props) {
	return (
		<Pressable
			className="group flex-row items-center gap-3 px-screen py-choice"
			accessibilityRole="button"
			accessibilityState={{ selected: isSelected, disabled }}
			disabled={disabled}
			onPress={onPress}
		>
			<PressedOverlay />
			{isSelected ? (
				<Label className="flex-1">{label}</Label>
			) : (
				<Body className="flex-1" tone={TEXT_TONE.DEFAULT}>
					{label}
				</Body>
			)}
			{badge === undefined ? null : <StatusPill tone={PILL_TONE.NEUTRAL} label={badge} />}
			{isSelected ? <CheckIcon /> : <OpenIcon />}
		</Pressable>
	)
}
