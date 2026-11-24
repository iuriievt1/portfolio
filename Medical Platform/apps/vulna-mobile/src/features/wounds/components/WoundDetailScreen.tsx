import { ScrollView, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { type LocalizedNameOf, useLocalizedName, useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { ActionMenu } from "../../../ui/ActionMenu"
import { MENU_LOOK, MENU_SYMBOL, type MenuAction } from "../../../ui/action-menu"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { InsetDivider } from "../../../ui/Divider"
import { DarkGlass } from "../../../ui/Glass"
import { GLASS_SHADOW } from "../../../ui/shadow"
import { Body, Detail, Heading, Label, TEXT_TONE } from "../../../ui/typography"
import { countText, fillText } from "../../../utils/fill-text"
import { formatDate } from "../../../utils/format-date"
import { clinicalSteps } from "../../assessment/instance-clinical-steps"
import { BrowseScreen } from "../../patient/components/BrowseScreen"
import { LOAD_STATE, type LoadState } from "../../remote/hooks/use-remote-content"
import type { WoundDetail } from "../hooks/use-wound-history"
import { latestBodySiteOf, photoSessionsOf, TIMELINE_ENTRY, timelineEntriesOf, trackedSinceOf } from "../timeline"
import { codeNameOf, woundPlaceLineOf, woundTitleOf } from "../wound-view"
import { TimelinePhotoEntry, TimelineTypeChangeEntry } from "./TimelineEntryView"

const CHANGE_TYPE_ACTION = "change-type"

interface Props {
	patient: Patient
	state: LoadState<WoundDetail>
	onBack: () => void
	onRetry: () => void
	onChangeType: (current: string) => void
	onOpenRecord: (acquisitionId: string) => void
	onOpenImage: (acquisitionId: string, imageId: string) => void
}

// CAP-020-R01, CAP-020-R02, CAP-020-R19, CAP-020-R21, CAP-017-R16, Figma 07 C.2, Figma 07 D.1, Figma 07 D.4
export function WoundDetailScreen({ patient, state, onBack, onRetry, onChangeType, onOpenRecord, onOpenImage }: Props) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const loaded = state.kind === LOAD_STATE.READY ? state : undefined
	const title =
		loaded === undefined
			? ""
			: woundTitleOf(latestBodySiteOf(loaded.history), loaded.codeLists.body_diagram.regions, nameOf, texts)
	const current = clinicalSteps().woundType ? loaded?.history.woundTypeCode : undefined
	return (
		<BrowseScreen
			title={title}
			patient={patient}
			trailing={current === undefined ? undefined : <WoundMenu onChangeType={() => onChangeType(current)} />}
			state={state}
			serverErrorHeading={texts.wounds.detail.loadFailed}
			onBack={onBack}
			onRetry={onRetry}
		>
			{(content) => (
				<ScrollView contentContainerClassName="gap-8 pt-6 pb-safe-gap-or-sheet">
					<WoundSummary content={content} nameOf={nameOf} texts={texts} />
					<View className="gap-1">
						<Label className="px-screen" tone={TEXT_TONE.MUTED} accessibilityRole="header">
							{texts.wounds.detail.timeline}
						</Label>
						<Timeline content={content} onRetry={onRetry} onOpenRecord={onOpenRecord} onOpenImage={onOpenImage} />
					</View>
				</ScrollView>
			)}
		</BrowseScreen>
	)
}

// HIG-09, E122, Vulna / Native / Patient navigation — leading
function WoundMenu({ onChangeType }: { onChangeType: () => void }) {
	const texts = useTexts().wounds
	const change: MenuAction = {
		key: CHANGE_TYPE_ACTION,
		label: texts.changeType.action,
		symbol: MENU_SYMBOL.CHANGE,
		isDestructive: false,
		unavailableReason: undefined,
		onSelect: onChangeType,
	}
	return (
		<View className="rounded-full" style={GLASS_SHADOW}>
			<DarkGlass
				className="h-11 w-11 items-center justify-center rounded-full"
				plainClassName="border border-glass-border bg-glass-base"
			>
				<ActionMenu label={texts.detail.menu} look={MENU_LOOK.BRAND} actions={[change]} />
			</DarkGlass>
		</View>
	)
}

interface SummaryProps {
	content: WoundDetail
	nameOf: LocalizedNameOf
	texts: Texts
}

// CAP-020-R01, CAP-020-R19, CAP-016-R19, CAP-017-R16
function WoundSummary({ content, nameOf, texts }: SummaryProps) {
	const { history, codeLists } = content
	const typeName = clinicalSteps().woundType
		? codeNameOf(codeLists.wound_types, history.woundTypeCode, nameOf)
		: undefined
	const place = woundPlaceLineOf(latestBodySiteOf(history), codeLists.body_diagram.regions, nameOf, texts)
	const since = trackedSinceOf(history)
	const detail = texts.wounds.detail
	return (
		<View className="gap-1 px-screen">
			{typeName === undefined ? null : <Heading>{typeName}</Heading>}
			{place === undefined ? null : <Body>{place}</Body>}
			{since === undefined ? null : (
				<Detail>
					{fillText(
						detail.tracked,
						{
							date: formatDate(new Date(since), texts.language),
							sessions: countText(detail.sessions, photoSessionsOf(history), texts.language),
						},
						texts.language,
					)}
				</Detail>
			)}
		</View>
	)
}

interface TimelineProps {
	content: WoundDetail
	onRetry: () => void
	onOpenRecord: (acquisitionId: string) => void
	onOpenImage: (acquisitionId: string, imageId: string) => void
}

// CAP-020-R12, CAP-020-R16, CAP-020-R19
function Timeline({ content, onRetry, onOpenRecord, onOpenImage }: TimelineProps) {
	const texts = useTexts()
	const { history, codeLists } = content
	if (history.isSourceUnavailable) {
		return (
			<View className="gap-4 px-screen py-3">
				<Body>{texts.wounds.detail.historyUnavailable}</Body>
				<Button label={texts.remote.retry} style={BUTTON_STYLE.SECONDARY} onPress={onRetry} />
			</View>
		)
	}
	const entries = timelineEntriesOf(history, clinicalSteps())
	if (entries.length === 0) {
		return <Body className="px-screen py-3">{texts.wounds.detail.empty}</Body>
	}
	return (
		<View>
			{entries.map((entry) => (
				<View key={entry.key}>
					{entry.kind === TIMELINE_ENTRY.PHOTO ? (
						<TimelinePhotoEntry
							item={entry.item}
							codeLists={codeLists}
							onOpenRecord={() => onOpenRecord(entry.item.acquisition_id)}
							onOpenImage={(imageId) => onOpenImage(entry.item.acquisition_id, imageId)}
						/>
					) : (
						<TimelineTypeChangeEntry change={entry.change} codeLists={codeLists} />
					)}
					<InsetDivider />
				</View>
			))}
		</View>
	)
}
