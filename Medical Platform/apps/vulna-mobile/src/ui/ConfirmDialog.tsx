import { Modal, Pressable, View } from "react-native"
import { CONTROL_FONT_SCALE } from "./font-scale"
import { Body, Label } from "./typography"

export interface DialogAction {
	label: string
	onPress: () => void
	disabled?: boolean
}

interface Props {
	title: string
	body: string
	primary?: DialogAction
	alternative?: DialogAction
	destructive?: DialogAction
	secondary?: DialogAction
}

export function ConfirmDialog({ title, body, primary, alternative, destructive, secondary }: Props) {
	return (
		<Modal transparent animationType="fade" statusBarTranslucent onRequestClose={(secondary ?? primary)?.onPress}>
			<View className="flex-1 items-center justify-center bg-dim">
				<View className="w-full max-w-alert rounded-alert bg-alert py-alert">
					<View className="gap-2.5 px-alert">
						<Label className="text-compact text-label-primary">{title}</Label>
						<Body className="text-compact text-label-primary">{body}</Body>
					</View>
					<View className="gap-2.5 px-alert-actions pt-alert-gap">
						{primary === undefined ? null : (
							<DialogButton action={primary} className="bg-primary" caption="text-primary-foreground" />
						)}
						{alternative === undefined ? null : (
							<DialogButton action={alternative} className="bg-fill-secondary" caption="text-label-primary" />
						)}
						{destructive === undefined ? null : (
							<DialogButton action={destructive} className="bg-fill-secondary" caption="text-destructive" />
						)}
						{secondary === undefined ? null : (
							<DialogButton action={secondary} className="bg-fill-secondary" caption="text-label-primary" />
						)}
					</View>
				</View>
			</View>
		</Modal>
	)
}

function DialogButton({ action, className, caption }: { action: DialogAction; className: string; caption: string }) {
	const disabled = action.disabled === true
	return (
		<Pressable
			className={`group h-12 items-center justify-center rounded-full ${disabled ? "bg-disabled" : className}`}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={action.onPress}
		>
			<View className="absolute inset-0 hidden rounded-full bg-foreground/10 group-active:flex" />
			<Label
				className={`font-medium text-compact ${disabled ? "text-disabled-foreground" : caption}`}
				numberOfLines={1}
				maxFontSizeMultiplier={CONTROL_FONT_SCALE}
			>
				{action.label}
			</Label>
		</Pressable>
	)
}
