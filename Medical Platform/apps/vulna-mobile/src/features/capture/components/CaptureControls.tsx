import { Pressable, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { GlassAction } from "../../../ui/GlassAction"
import { FlashlightIcon } from "../../../ui/icons/FlashlightIcon"
import { PillButton } from "./PillButton"

interface Props {
	canUseCamera: boolean
	canShoot: boolean
	canContinue: boolean
	shutterLabel?: string
	onTorch: () => void
	onShoot: () => void
	onContinue: () => void
}

// CAP-015-R10, Vulna / Capture / Controls
export function CaptureControls({
	canUseCamera,
	canShoot,
	canContinue,
	shutterLabel,
	onTorch,
	onShoot,
	onContinue,
}: Props) {
	const texts = useTexts().capture
	return (
		<View className="h-shutter flex-row items-center justify-between px-screen">
			<View className={canUseCamera ? "" : "opacity-capture-disabled"} pointerEvents={canUseCamera ? "auto" : "none"}>
				<GlassAction label={texts.torch} onPress={onTorch}>
					<FlashlightIcon />
				</GlassAction>
			</View>
			<View className="absolute inset-x-0 items-center" pointerEvents="box-none">
				<Shutter label={shutterLabel ?? texts.shutter} isEnabled={canShoot} onPress={onShoot} />
			</View>
			<PillButton label={texts.continue} className="px-3.5" isEnabled={canContinue} onPress={onContinue} />
		</View>
	)
}

function Shutter({ label, isEnabled, onPress }: { label: string; isEnabled: boolean; onPress: () => void }) {
	return (
		<Pressable
			className={`group h-shutter w-shutter items-center justify-center rounded-full border-shutter border-shutter-ring ${isEnabled ? "" : "opacity-capture-disabled"}`}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: !isEnabled }}
			disabled={!isEnabled}
			onPress={onPress}
		>
			<View className="h-shutter-core w-shutter-core rounded-full bg-primary-foreground group-active:opacity-pressed" />
		</Pressable>
	)
}
