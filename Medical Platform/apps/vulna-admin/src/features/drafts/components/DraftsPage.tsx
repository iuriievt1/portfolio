import { OPERATOR_STATE } from "@ansora/contracts"
import { FileDashedIcon, XIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EmptyState } from "@/components/custom/empty-state"
import { ListFooter } from "@/components/custom/list-footer"
import { LoadFailure } from "@/components/custom/load-failure"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { RowButton } from "@/components/custom/row-button"
import { PILL_TONE, StatusPill } from "@/components/custom/status-pill"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { RecordsTabs } from "@/features/acquisitions/components/RecordsTabs"
import { useConfiguration } from "@/features/configuration/hooks/use-configuration"
import { DiscardConsentDialog } from "@/features/drafts/components/DiscardConsentDialog"
import { DraftResultNotice } from "@/features/drafts/components/DraftResultNotice"
import { useDrafts } from "@/features/drafts/hooks/use-drafts"
import {
	draftFilterOf,
	draftFilterParams,
	draftQueryOf,
	draftTimingOf,
	isStale,
	lastLoginText,
	STALE_AGE,
} from "@/features/drafts/lib/draft-view"
import type {
	AdministeredDraft,
	DraftDiscardResult,
	DraftFilter,
	DraftSelection,
	DraftTiming,
} from "@/features/drafts/types/draft.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { fillText, formatCount, formatDateTime, formatDuration } from "@/lib/format"

const texts = cs.drafts

const AGE_FIELD_ID = "draft-age"
const ALL_AGES = "all"
const SKELETON_ROWS = 5
const SKELETON_COLUMNS = 5

// CAP-004-R14, CAP-015-R19, CAP-015-R20, CAP-026-R16, stavy-a-mikrocopy.md E96
export function DraftsPage() {
	useShellTitle(cs.acquisitions.heading)
	const [searchParams, setSearchParams] = useSearchParams()
	const filter = draftFilterOf(searchParams)
	const configuration = useConfiguration()
	const timing = draftTimingOf(configuration.data)
	const [generation, setGeneration] = useState(0)
	const [result, setResult] = useState<DraftDiscardResult | undefined>(undefined)

	const showFilter = (next: DraftFilter) => {
		setResult(undefined)
		setSearchParams(draftFilterParams(next), { replace: true })
	}

	const showDiscarded = (discarded: DraftDiscardResult) => {
		setResult(discarded)
		setGeneration((current) => current + 1)
	}

	const isAgeUnknown = filter.isStaleOnly && timing.reminderSeconds === undefined
	const listKey = `${filter.operatorUserId ?? ""}:${filter.isStaleOnly}:${generation}`

	return (
		<Card className="gap-0 py-0">
			<RecordsTabs />
			<DraftFilters filter={filter} timing={timing} onChange={showFilter} />
			{result === undefined ? null : (
				<div className="p-(--card-p) pb-0">
					<DraftResultNotice result={result} />
				</div>
			)}
			{isAgeUnknown ? (
				<AgeUnknown error={configuration.error} onRetry={configuration.reload} />
			) : (
				<DraftsList
					key={listKey}
					filter={filter}
					timing={timing}
					onShowOperator={(operatorUserId) => showFilter({ ...filter, operatorUserId })}
					onDiscarded={showDiscarded}
				/>
			)}
		</Card>
	)
}

// CAP-012-R31
function AgeUnknown({ error, onRetry }: { error: unknown; onRetry: () => void }) {
	if (error === undefined) {
		return <TableSkeleton columns={SKELETON_COLUMNS} rows={SKELETON_ROWS} label={cs.common.loading} />
	}
	return <LoadFailure title={errorMessageOf(error)} retryLabel={cs.errors.retry} onRetry={onRetry} />
}

function DraftFilters({
	filter,
	timing,
	onChange,
}: {
	filter: DraftFilter
	timing: DraftTiming
	onChange: (filter: DraftFilter) => void
}) {
	const staleLabel =
		timing.reminderSeconds === undefined
			? texts.filters.ageStaleUnknown
			: fillText(texts.filters.ageStale, { duration: formatDuration(timing.reminderSeconds) })
	return (
		<div className="flex flex-col gap-3 border-b p-(--card-p) sm:flex-row sm:items-end sm:justify-between">
			<div className="flex max-w-xs flex-1 flex-col gap-1.5">
				<Label htmlFor={AGE_FIELD_ID} className="label-caps text-xs text-muted-foreground">
					{texts.filters.age}
				</Label>
				<NativeSelect
					id={AGE_FIELD_ID}
					value={filter.isStaleOnly ? STALE_AGE : ALL_AGES}
					onChange={(event) => onChange({ ...filter, isStaleOnly: event.target.value === STALE_AGE })}
				>
					<option value={ALL_AGES}>{texts.filters.ageAll}</option>
					<option value={STALE_AGE}>{staleLabel}</option>
				</NativeSelect>
			</div>
			{filter.operatorUserId === undefined ? null : (
				<Button variant="outline" size="sm" onClick={() => onChange({ ...filter, operatorUserId: undefined })}>
					<XIcon aria-hidden />
					{texts.filters.clearOperator}
				</Button>
			)}
		</div>
	)
}

function DraftsList({
	filter,
	timing,
	onShowOperator,
	onDiscarded,
}: {
	filter: DraftFilter
	timing: DraftTiming
	onShowOperator: (operatorUserId: string) => void
	onDiscarded: (result: DraftDiscardResult) => void
}) {
	const now = useMemo(() => new Date(), [])
	const query = draftQueryOf(filter, timing.reminderSeconds, now)
	const { items: drafts, error, loading, hasMore, more, retry } = useDrafts(query)
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
	const [isConsentOpen, setConsentOpen] = useState(false)
	const operatorDraft = filter.operatorUserId === undefined ? undefined : drafts[0]
	const isSelectable = operatorDraft?.is_discard_consent_allowed === true

	const selection: DraftSelection = {
		selectedIds,
		isSelectable,
		isAllSelected: drafts.length > 0 && drafts.every((draft) => selectedIds.has(draft.acquisition_id)),
		toggle: (draftId) =>
			setSelectedIds((current) => {
				const next = new Set(current)
				if (!next.delete(draftId)) {
					next.add(draftId)
				}
				return next
			}),
		toggleAll: () =>
			setSelectedIds((current) =>
				drafts.every((draft) => current.has(draft.acquisition_id))
					? new Set()
					: new Set(drafts.map((draft) => draft.acquisition_id)),
			),
	}
	const columns = columnsOf(filter, timing, now, selection, onShowOperator)

	if (drafts.length === 0) {
		if (loading) {
			return <TableSkeleton columns={columns.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		if (error !== undefined) {
			return <LoadFailure title={errorMessageOf(error)} retryLabel={cs.errors.retry} onRetry={retry} />
		}
		return (
			<EmptyState
				icon={<FileDashedIcon weight="bold" className="size-5" />}
				title={filter.isStaleOnly ? texts.emptyStale : texts.empty}
				description={texts.emptyHint}
			/>
		)
	}
	const selectedDrafts = drafts.filter((draft) => selectedIds.has(draft.acquisition_id))
	return (
		<>
			<div className="p-(--card-p) pb-0">
				<ConsentBar
					operatorDraft={operatorDraft}
					timing={timing}
					now={now}
					selectedCount={selectedDrafts.length}
					onDiscard={() => setConsentOpen(true)}
				/>
			</div>
			<DataTable
				columns={columns}
				data={drafts}
				label={texts.tableLabel}
				emptyLabel={texts.empty}
				rowId={(draft) => draft.acquisition_id}
			/>
			<ListFooter
				errorMessage={error === undefined ? undefined : errorMessageOf(error)}
				hasMore={hasMore}
				loading={loading}
				moreLabel={cs.common.more}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onMore={more}
				onRetry={retry}
			/>
			{operatorDraft === undefined ? null : (
				<DiscardConsentDialog
					open={isConsentOpen}
					operatorName={operatorDraft.operator_display_name}
					drafts={selectedDrafts}
					onOpenChange={setConsentOpen}
					onDiscarded={(result) => {
						setConsentOpen(false)
						onDiscarded(result)
					}}
				/>
			)}
		</>
	)
}

// CAP-015-R19, CAP-015-S20
function ConsentBar({
	operatorDraft,
	timing,
	now,
	selectedCount,
	onDiscard,
}: {
	operatorDraft: AdministeredDraft | undefined
	timing: DraftTiming
	now: Date
	selectedCount: number
	onDiscard: () => void
}) {
	if (operatorDraft === undefined) {
		return <p className="text-sm text-muted-foreground">{texts.chooseOperator}</p>
	}
	if (!operatorDraft.is_discard_consent_allowed) {
		return <Notice tone={NOTICE_TONE.WARN}>{notAllowedText(operatorDraft, timing, now)}</Notice>
	}
	return (
		<div className="flex justify-end">
			<Button variant="destructive" size="sm" disabled={selectedCount === 0} onClick={onDiscard}>
				{fillText(texts.discard, { count: formatCount(selectedCount) })}
			</Button>
		</div>
	)
}

function notAllowedText(draft: AdministeredDraft, timing: DraftTiming, now: Date): string {
	const lastLoginAt = draft.last_login_at ?? undefined
	return fillText(texts.notAllowed, {
		when: lastLoginAt === undefined ? cs.common.notStated : lastLoginText(lastLoginAt, now),
		duration: timing.absenceSeconds === undefined ? cs.common.notStated : formatDuration(timing.absenceSeconds),
	})
}

function columnsOf(
	filter: DraftFilter,
	timing: DraftTiming,
	now: Date,
	selection: DraftSelection,
	onShowOperator: (operatorUserId: string) => void,
): ColumnDef<AdministeredDraft>[] {
	const columns: ColumnDef<AdministeredDraft>[] = [
		{
			id: "operator",
			header: texts.columns.operator,
			cell: ({ row }) => <OperatorCell draft={row.original} filter={filter} onShowOperator={onShowOperator} />,
		},
		{
			id: "patient",
			header: texts.columns.patient,
			cell: ({ row }) => <span className="identifier">{row.original.patient_identifier}</span>,
		},
		{
			id: "kind",
			header: texts.columns.kind,
			meta: { hideBelow: HIDE_BELOW.SM },
			cell: ({ row }) => texts.kind[row.original.kind],
		},
		{
			id: "files",
			header: texts.columns.files,
			meta: { hideBelow: HIDE_BELOW.SM },
			cell: ({ row }) => <span className="num">{formatCount(row.original.file_count)}</span>,
		},
		{
			id: "started_at",
			header: texts.columns.startedAt,
			meta: { hideBelow: HIDE_BELOW.MD },
			cell: ({ row }) => formatDateTime(row.original.started_at),
		},
		{
			id: "updated_at",
			header: texts.columns.updatedAt,
			cell: ({ row }) => <UpdatedCell draft={row.original} timing={timing} now={now} />,
		},
	]
	if (!selection.isSelectable) {
		return columns
	}
	return [
		{
			id: "select",
			header: () => (
				<Checkbox
					aria-label={texts.selectAll}
					checked={selection.isAllSelected}
					onCheckedChange={selection.toggleAll}
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					aria-label={fillText(texts.selectRow, { patient: row.original.patient_identifier })}
					checked={selection.selectedIds.has(row.original.acquisition_id)}
					onCheckedChange={() => selection.toggle(row.original.acquisition_id)}
				/>
			),
		},
		...columns,
	]
}

function OperatorCell({
	draft,
	filter,
	onShowOperator,
}: {
	draft: AdministeredDraft
	filter: DraftFilter
	onShowOperator: (operatorUserId: string) => void
}) {
	const isRevoked = draft.operator_state === OPERATOR_STATE.REVOKED
	return (
		<div className="flex flex-wrap items-center gap-2">
			{filter.operatorUserId === undefined ? (
				<RowButton onClick={() => onShowOperator(draft.operator_user_id)}>
					<span className="sr-only">{fillText(texts.showOperator, { name: draft.operator_display_name })}</span>
					<span aria-hidden>{draft.operator_display_name}</span>
				</RowButton>
			) : (
				<span className="font-medium">{draft.operator_display_name}</span>
			)}
			{isRevoked ? <StatusPill tone={PILL_TONE.NEUTRAL}>{texts.revoked}</StatusPill> : null}
		</div>
	)
}

// CAP-015-R18, CAP-026-R16, stavy-a-mikrocopy.md E97
function UpdatedCell({ draft, timing, now }: { draft: AdministeredDraft; timing: DraftTiming; now: Date }) {
	const reminderSeconds = timing.reminderSeconds
	return (
		<div className="flex flex-wrap items-center gap-2">
			<span>{formatDateTime(draft.updated_at)}</span>
			{reminderSeconds !== undefined && isStale(draft.updated_at, reminderSeconds, now) ? (
				<StatusPill tone={PILL_TONE.WARN}>
					{fillText(texts.stale, { duration: formatDuration(reminderSeconds) })}
				</StatusPill>
			) : null}
		</div>
	)
}
