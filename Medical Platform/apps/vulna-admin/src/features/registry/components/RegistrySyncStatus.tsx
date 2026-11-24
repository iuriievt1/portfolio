import { SYNC_STATE, type SyncStateValue } from "@ansora/contracts"
import { DetailFields } from "@/components/custom/detail-fields"
import { LoadFailure } from "@/components/custom/load-failure"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PILL_TONE, type PillTone, StatusPill } from "@/components/custom/status-pill"
import { Skeleton } from "@/components/ui/skeleton"
import { useSyncState } from "@/features/registry/hooks/use-sync-state"
import type { SyncState } from "@/features/registry/types/registry.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { formatCount, formatDateTime } from "@/lib/format"

const texts = cs.registry.sync

const STATE_TONE: Readonly<Record<SyncStateValue, PillTone>> = {
	[SYNC_STATE.RUNNING]: PILL_TONE.NEUTRAL,
	[SYNC_STATE.WAITING]: PILL_TONE.NEUTRAL,
	[SYNC_STATE.FAILED]: PILL_TONE.CRITICAL,
	[SYNC_STATE.INCOMPLETE_OUTCOME]: PILL_TONE.WARN,
}

const STATE_LABEL: Readonly<Record<SyncStateValue, string>> = texts.stateValue

// NAB-347, CAP-024-R04
export function RegistrySyncStatus() {
	const syncState = useSyncState()

	if (syncState.data === undefined) {
		return syncState.error === undefined ? (
			<div role="status">
				<span className="sr-only">{cs.common.loading}</span>
				<Skeleton aria-hidden className="h-12" />
			</div>
		) : (
			<LoadFailure title={errorMessageOf(syncState.error)} retryLabel={cs.errors.retry} onRetry={syncState.reload} />
		)
	}
	return <SyncStateDetails state={syncState.data} />
}

function SyncStateDetails({ state }: { state: SyncState }) {
	return (
		<div className="flex flex-col gap-4">
			{state.state === SYNC_STATE.INCOMPLETE_OUTCOME ? (
				<Notice tone={NOTICE_TONE.WARN}>{texts.incomplete}</Notice>
			) : null}
			{state.state === SYNC_STATE.FAILED ? <Notice tone={NOTICE_TONE.CRITICAL}>{texts.failed}</Notice> : null}
			<DetailFields
				fields={[
					{
						term: texts.state,
						value: <StatusPill tone={STATE_TONE[state.state]}>{STATE_LABEL[state.state]}</StatusPill>,
					},
					{
						term: texts.lastRun,
						value: state.last_run_at === undefined ? cs.common.never : formatDateTime(state.last_run_at),
					},
					{
						term: texts.cachedPatients,
						value: <span className="num">{formatCount(state.cached_patient_count ?? 0)}</span>,
					},
				]}
			/>
		</div>
	)
}
