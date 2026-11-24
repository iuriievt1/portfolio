import { ScrollView, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { InsetDivider } from "../../../ui/Divider"
import { SheetHeader } from "../../../ui/SheetHeader"
import { Spinner } from "../../../ui/Spinner"
import { StatusPill } from "../../../ui/StatusPill"
import { Body, Detail, Label } from "../../../ui/typography"
import { RecordKindIcon } from "../../visit/components/RecordKindIcon"
import { useQueueView } from "../hooks/use-queue-view"
import { othersQueueTextOf, queuedRecordDetailOf, queuedRecordStatusOf } from "../queue-text"
import type { OthersQueue, QueuedRecord, QueueView } from "../queue-view"

// CAP-019-R08, CAP-019-R23, E53
export function QueueSheet({ onClose }: { onClose: () => void }) {
	const texts = useTexts().queue
	const view = useQueueView()
	return (
		<View className="flex-1 bg-card">
			<SheetHeader title={texts.title} closeLabel={texts.close} onClose={onClose} />
			{view === undefined ? (
				<View className="flex-1 items-center justify-center">
					<Spinner />
				</View>
			) : (
				<QueueList view={view} />
			)}
		</View>
	)
}

function QueueList({ view }: { view: QueueView }) {
	const texts = useTexts()
	const now = new Date()
	if (view.own.length === 0 && view.others.recordCount === 0) {
		return <Body className="px-screen pt-6">{texts.queue.empty}</Body>
	}
	return (
		<ScrollView contentContainerClassName="pt-4 pb-safe-gap-or-6">
			{view.own.map((record) => (
				<View key={record.acquisitionId}>
					<QueuedRecordRow record={record} now={now} />
					<InsetDivider />
				</View>
			))}
			{view.others.recordCount === 0 ? null : <OthersRow others={view.others} />}
		</ScrollView>
	)
}

// CAP-019-R14, CAP-019-R24
function QueuedRecordRow({ record, now }: { record: QueuedRecord; now: Date }) {
	const texts = useTexts()
	const status = queuedRecordStatusOf(record, texts)
	return (
		<View className="min-h-14 flex-row items-center gap-3 px-screen py-3">
			<RecordKindIcon kind={record.kind} />
			<View className="flex-1 gap-1">
				<Label numberOfLines={1}>{texts.visit.record.kind[record.kind]}</Label>
				<View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
					<StatusPill tone={status.tone} label={status.label} />
					<Detail>{queuedRecordDetailOf(record, now, texts)}</Detail>
				</View>
			</View>
		</View>
	)
}

// CAP-019-R23, CAP-019-S08
function OthersRow({ others }: { others: OthersQueue }) {
	const text = othersQueueTextOf(others, useTexts())
	return (
		<View className="min-h-14 justify-center gap-1 px-screen py-3">
			<Label>{text.label}</Label>
			<Detail>{text.detail}</Detail>
		</View>
	)
}
