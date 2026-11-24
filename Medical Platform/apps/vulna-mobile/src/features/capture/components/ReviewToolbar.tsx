import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { CropIcon } from "../../../ui/icons/CropIcon"
import { RotateIcon } from "../../../ui/icons/RotateIcon"
import { TrashIcon } from "../../../ui/icons/TrashIcon"
import { PressedOverlay } from "../../../ui/PressedOverlay"
import { PillButton } from "./PillButton"

interface Props {
	isBusy: boolean
	retakeLabel: string | undefined
	onDelete: () => void
	onRotate: () => void
	onCrop: () => void
	onRetake: () => void
	onClose: () => void
}

// CAP-015-R32, CAP-015-R34, CAP-015-R18, CAP-015-R36, CAP-009-S05, Q-076
export function ReviewToolbar({ isBusy, retakeLabel, onDelete, onRotate, onCrop, onRetake, onClose }: Props) {
	const texts = useTexts().capture.review
	return (
		<View className="flex-row items-center gap-3 px-screen">
			<Tool label={texts.delete} isBusy={isBusy} onPress={onDelete}>
				<TrashIcon />
			</Tool>
			<View className="w-tool-gap shrink" />
			{retakeLabel === undefined ? (
				<>
					<Tool label={texts.rotate} isBusy={isBusy} onPress={onRotate}>
						<RotateIcon />
					</Tool>
					<Tool label={texts.crop} isBusy={isBusy} onPress={onCrop}>
						<CropIcon />
					</Tool>
					<PillButton label={texts.close} className="shrink-0 grow px-5" isBusy={isBusy} onPress={onClose} />
				</>
			) : (
				<PillButton label={retakeLabel} className="shrink-0 grow px-5" isBusy={isBusy} onPress={onRetake} />
			)}
		</View>
	)
}

function Tool({
	label,
	isBusy,
	onPress,
	children,
}: {
	label: string
	isBusy: boolean
	onPress: () => void
	children: ReactNode
}) {
	return (
		<Pressable
			className={`group h-tool w-tool items-center justify-center rounded-full bg-capture-control ${isBusy ? "opacity-capture-disabled" : ""}`}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: isBusy }}
			disabled={isBusy}
			onPress={onPress}
		>
			<PressedOverlay className="rounded-full" />
			{children}
		</Pressable>
	)
}
