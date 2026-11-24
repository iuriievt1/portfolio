import { type LayoutChangeEvent, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { Fog } from "../../../ui/Fog"
import { BandaidsIcon } from "../../../ui/icons/BandaidsIcon"
import { FileTextIcon } from "../../../ui/icons/FileTextIcon"
import { ActionTile } from "./ActionTile"

export interface VisitAdditions {
	onPhoto: () => void
	onScan: (() => void) | undefined
}

interface Props {
	additions: VisitAdditions | undefined
	canFinish: boolean
	isFinishing: boolean
	onFinish: () => void
	onLater: () => void
	onLayout: (event: LayoutChangeEvent) => void
}

const TILE_ICON_SIZE = 24

// CAP-014-R20, CAP-014-R22, CAP-014-R30, E100, E101, E120
export function ActionsPanel({ additions, canFinish, isFinishing, onFinish, onLater, onLayout }: Props) {
	const texts = useTexts().visit
	return (
		<View className="absolute right-0 bottom-0 left-0" onLayout={onLayout}>
			<Fog />
			<View className="gap-7 bg-background px-screen pb-safe-gap-or-sheet">
				{additions === undefined ? null : (
					<View className="flex-row gap-tile-gap">
						<ActionTile
							icon={<BandaidsIcon size={TILE_ICON_SIZE} />}
							label={texts.photo}
							surface="bg-category-wound"
							caption="text-category-wound-foreground"
							onPress={additions.onPhoto}
						/>
						{additions.onScan === undefined ? null : (
							<ActionTile
								icon={<FileTextIcon size={TILE_ICON_SIZE} />}
								label={texts.scan}
								surface="bg-status-info"
								caption="text-status-info-foreground"
								onPress={additions.onScan}
							/>
						)}
					</View>
				)}
				<View className="gap-2">
					<Button label={texts.finish} onPress={onFinish} disabled={!canFinish} waiting={isFinishing} />
					<Button label={texts.later} onPress={onLater} style={BUTTON_STYLE.SECONDARY} />
				</View>
			</View>
		</View>
	)
}
