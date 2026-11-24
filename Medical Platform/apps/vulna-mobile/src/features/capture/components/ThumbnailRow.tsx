import { type ReactNode, useEffect, useRef, useState } from "react"
import { type LayoutChangeEvent, Pressable, ScrollView, type ScrollViewInstance, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import sizes from "../../../styles/sizes.json"
import { photoLabelOf } from "../series-text"

// Vulna / Capture / Series row
const THUMBNAIL_SIZE = sizes.thumbnail
const THUMBNAIL_GAP = sizes["thumbnail-gap"]
const NO_INSET = 0

export interface RowThumbnail {
	key: string
	isPending?: boolean
	thumbnail: (className: string) => ReactNode
}

interface Props {
	items: readonly RowThumbnail[]
	selectedKey?: string
	hasSlot?: boolean
	isInset?: boolean
	isFollowingEnd?: boolean
	label?: string
	slotLabel?: string
	itemLabelOf?: (index: number) => string
	onSelect: (key: string) => void
}

// CAP-015-R32, CAP-015-R33, Figma 05 F
export function ThumbnailRow({
	items,
	selectedKey,
	hasSlot = false,
	isInset = false,
	isFollowingEnd = false,
	label,
	slotLabel,
	itemLabelOf,
	onSelect,
}: Props) {
	const texts = useTexts()
	const scroll = useRef<ScrollViewInstance>(null)
	const [width, setWidth] = useState(0)
	const measure = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)
	const selectedIndex = items.findIndex((item) => item.key === selectedKey)
	const inset = isInset ? sizes.screen : NO_INSET

	useEffect(() => {
		if (selectedIndex < 0) {
			return
		}
		const center = inset + selectedIndex * (THUMBNAIL_SIZE + THUMBNAIL_GAP) + THUMBNAIL_SIZE / 2
		scroll.current?.scrollTo({ x: Math.max(center - width / 2, 0), animated: true })
	}, [selectedIndex, width, inset])

	const showNewest = () => {
		if (isFollowingEnd && selectedIndex < 0) {
			scroll.current?.scrollToEnd({ animated: true })
		}
	}

	return (
		<ScrollView
			ref={scroll}
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerClassName={isInset ? "gap-thumbnail-gap px-screen pt-1.5 pb-2.5" : "gap-thumbnail-gap"}
			accessibilityLabel={label}
			onLayout={measure}
			onContentSizeChange={showNewest}
		>
			{items.map((item, index) => {
				const isSelected = item.key === selectedKey
				return (
					<Pressable
						key={item.key}
						accessibilityRole="imagebutton"
						accessibilityLabel={itemLabelOf === undefined ? photoLabelOf(index, texts) : itemLabelOf(index)}
						accessibilityState={{ selected: isSelected, busy: item.isPending }}
						disabled={item.isPending}
						onPress={() => onSelect(item.key)}
					>
						{item.thumbnail(
							`h-thumbnail w-thumbnail rounded-lg ${isSelected ? "border-selected border-primary-foreground" : ""}`,
						)}
					</Pressable>
				)
			})}
			{hasSlot ? (
				<View
					className="h-thumbnail w-thumbnail rounded-lg border-dash border-capture-outline border-dashed"
					accessible
					accessibilityLabel={slotLabel ?? texts.capture.addSlot}
				/>
			) : null}
		</ScrollView>
	)
}
