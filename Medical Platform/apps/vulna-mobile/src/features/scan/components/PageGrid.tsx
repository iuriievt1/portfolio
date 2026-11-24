import { useEffect, useMemo, useState } from "react"
import { type LayoutChangeEvent, Pressable, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { PlusIcon } from "../../../ui/icons/PlusIcon"
import { LIFTED_SHADOW } from "../../../ui/shadow"
import { Caption, TEXT_TONE } from "../../../ui/typography"
import { FileStateMark } from "../../summary/components/FileStateMark"
import { PageFileThumbnail } from "../../summary/components/RecordFileThumbnail"
import { fileStateLabelOf } from "../../summary/retake"
import { isOpenable, type RecordFile } from "../../summary/shown-file"
import { columnsWithin, gridHeightOf, indexAt, movedKeys, PAGE_TILE_HEIGHT, slotOf } from "../page-grid-layout"
import { pageLabelOf } from "../page-text"

// CAP-018-R11
const LONG_PRESS_MS = 300
const LIFTED_SCALE = 1.05
const RESTING_SCALE = 1
const SETTLE = { duration: 180 }
const NO_KEY = ""

interface Props {
	pages: readonly RecordFile[]
	isLocked: boolean
	onOpen: (page: RecordFile) => void
	onAdd: () => void
	onReorder: (fileKeys: readonly string[]) => void
	onSortingChange: (isSorting: boolean) => void
}

interface Sorting {
	order: SharedValue<string[]>
	active: SharedValue<string>
	dropping: SharedValue<string>
	columns: number
}

// CAP-018-R11, CAP-018-S10, CAP-018-R14, CAP-015-R36, CAP-009-S05, E112, Q-076, Figma 06 A.4, B.1, Vulna / Media / Grid
export function PageGrid({ pages, isLocked, onOpen, onAdd, onReorder, onSortingChange }: Props) {
	const texts = useTexts()
	const [width, setWidth] = useState(0)
	const measure = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)
	const columns = columnsWithin(width)
	const keys = useMemo(() => pages.map((page) => page.fileKey), [pages])
	const [shown, setShown] = useState<readonly string[]>(keys)
	const [dragged, setDragged] = useState<string | undefined>(undefined)
	const order = useSharedValue<string[]>([...keys])
	const active = useSharedValue(NO_KEY)
	const dropping = useSharedValue(NO_KEY)

	useEffect(() => {
		order.value = [...keys]
		setShown(keys)
	}, [keys, order])

	const open = (fileKey: string) => {
		const page = pages.find((candidate) => candidate.fileKey === fileKey)
		if (page !== undefined) {
			onOpen(page)
		}
	}

	const lift = (fileKey: string) => {
		setDragged(fileKey)
		onSortingChange(true)
	}

	const drop = (next: readonly string[]) => {
		setDragged(undefined)
		onSortingChange(false)
		setShown(next)
		if (next.join() !== keys.join()) {
			onReorder(next)
		}
	}

	if (width === 0) {
		return <View onLayout={measure} />
	}

	const sorting: Sorting = { order, active, dropping, columns }
	const draggedIndex = dragged === undefined ? -1 : shown.indexOf(dragged)
	const addSlot = slotOf(pages.length, columns)

	return (
		<View style={{ height: gridHeightOf(pages.length + 1, columns) }} onLayout={measure}>
			{draggedIndex < 0 ? null : <DropPlace index={draggedIndex} columns={columns} />}
			{pages.map((page) => {
				const index = shown.indexOf(page.fileKey)
				return (
					<SortableTile
						key={page.fileKey}
						page={page}
						number={index + 1}
						isLifted={dragged === page.fileKey}
						label={pageLabelOf(index, texts)}
						stateLabel={fileStateLabelOf(page.condition, texts)}
						isLocked={isLocked}
						sorting={sorting}
						onOpen={open}
						onLift={lift}
						onMove={setShown}
						onDrop={drop}
					/>
				)
			})}
			<Pressable
				className="absolute items-center gap-1.5"
				style={{ left: addSlot.x, top: addSlot.y }}
				accessibilityRole="button"
				accessibilityLabel={texts.scan.summary.addTile}
				disabled={isLocked}
				onPress={onAdd}
			>
				<View
					className="w-grid-tile items-center justify-center rounded-md border-dot border-muted-foreground border-dashed"
					style={{ height: PAGE_TILE_HEIGHT }}
				>
					<PlusIcon color={colors.primary} />
				</View>
				<Caption tone={TEXT_TONE.ACCENT}>{texts.scan.summary.addTile}</Caption>
			</Pressable>
		</View>
	)
}

function DropPlace({ index, columns }: { index: number; columns: number }) {
	const slot = slotOf(index, columns)
	return (
		<View
			className="absolute w-grid-tile rounded-md border-scan-edge border-selected border-dashed"
			style={{ left: slot.x, top: slot.y, height: PAGE_TILE_HEIGHT }}
			pointerEvents="none"
		/>
	)
}

interface TileProps {
	page: RecordFile
	number: number
	isLifted: boolean
	label: string
	stateLabel: string | undefined
	isLocked: boolean
	sorting: Sorting
	onOpen: (fileKey: string) => void
	onLift: (fileKey: string) => void
	onMove: (fileKeys: readonly string[]) => void
	onDrop: (fileKeys: readonly string[]) => void
}

function SortableTile({
	page,
	number,
	isLifted,
	label,
	stateLabel,
	isLocked,
	sorting,
	onOpen,
	onLift,
	onMove,
	onDrop,
}: TileProps) {
	const { order, active, dropping, columns } = sorting
	const key = page.fileKey
	const x = useSharedValue(0)
	const y = useSharedValue(0)
	const start = useSharedValue({ x: 0, y: 0 })

	const pan = Gesture.Pan()
		.enabled(!isLocked)
		.activateAfterLongPress(LONG_PRESS_MS)
		.onStart(() => {
			const slot = slotOf(order.value.indexOf(key), columns)
			start.value = slot
			x.value = slot.x
			y.value = slot.y
			active.value = key
			scheduleOnRN(onLift, key)
		})
		.onUpdate((event) => {
			x.value = start.value.x + event.translationX
			y.value = start.value.y + event.translationY
			const from = order.value.indexOf(key)
			const to = indexAt({ x: x.value, y: y.value }, columns, order.value.length)
			if (to !== from) {
				order.value = movedKeys(order.value, from, to)
				scheduleOnRN(onMove, order.value)
			}
		})
		.onFinalize(() => {
			if (active.value !== key) {
				return
			}
			const slot = slotOf(order.value.indexOf(key), columns)
			active.value = NO_KEY
			dropping.value = key
			x.value = withTiming(slot.x, SETTLE)
			y.value = withTiming(slot.y, SETTLE, () => {
				dropping.value = NO_KEY
			})
			scheduleOnRN(onDrop, order.value)
		})
	const tap = Gesture.Tap()
		.enabled(!isLocked && isOpenable(page))
		.onEnd(() => {
			scheduleOnRN(onOpen, key)
		})

	const placed = useAnimatedStyle(() => {
		const slot = slotOf(order.value.indexOf(key), columns)
		const isHeld = active.value === key || dropping.value === key
		const isSorting = active.value !== NO_KEY
		const toX = isSorting ? withTiming(slot.x, SETTLE) : slot.x
		const toY = isSorting ? withTiming(slot.y, SETTLE) : slot.y
		return {
			zIndex: isHeld ? 1 : 0,
			transform: [
				{ translateX: isHeld ? x.value : toX },
				{ translateY: isHeld ? y.value : toY },
				{ scale: withTiming(active.value === key ? LIFTED_SCALE : RESTING_SCALE, SETTLE) },
			],
		}
	})

	return (
		<GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
			<Animated.View
				className="absolute top-0 left-0 items-center gap-1.5"
				style={placed}
				accessible
				accessibilityRole="imagebutton"
				accessibilityLabel={label}
				accessibilityHint={stateLabel}
			>
				<View
					className="w-grid-tile overflow-hidden rounded-md border border-border bg-card"
					style={[{ height: PAGE_TILE_HEIGHT }, isLifted ? LIFTED_SHADOW : undefined]}
				>
					<PageFileThumbnail file={page} className="h-full w-full" />
					<FileStateMark condition={page.condition} />
				</View>
				<Caption tone={TEXT_TONE.MUTED} className={isLifted ? "opacity-0" : undefined}>
					{number}
				</Caption>
			</Animated.View>
		</GestureDetector>
	)
}
