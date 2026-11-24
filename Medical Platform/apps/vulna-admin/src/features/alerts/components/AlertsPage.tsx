import { BellIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { cn } from "cn"
import { useSearchParams } from "react-router"
import { EMPTY_TONE, EmptyState } from "@/components/custom/empty-state"
import { ListFooter } from "@/components/custom/list-footer"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { RowLink } from "@/components/custom/row-link"
import { PILL_TONE, type PillTone, StatusPill } from "@/components/custom/status-pill"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { OperationalDetailsCard } from "@/features/alerts/components/OperationalDetailsCard"
import { SystemStatusCard } from "@/features/alerts/components/SystemStatusCard"
import { type AlertAction, useAlertAction } from "@/features/alerts/hooks/use-alert-action"
import { acknowledgeAlert, requeueClinicalRecordWrite, useAlerts } from "@/features/alerts/hooks/use-alerts"
import { useOperationalMetrics } from "@/features/alerts/hooks/use-operational-metrics"
import {
	ALERT_STATE,
	ALERT_VIEW,
	type AlertState,
	type AlertView,
	alertKindText,
	alertStateOf,
	alertViewOf,
	brokenAuditRecordOf,
	isAcknowledgeable,
	isAlreadyRequeued,
	isNoLongerAcknowledgeable,
	isOrphanedObjectsAlert,
	isStaleDraftsAlert,
	renditionTextOf,
	requeueTaskOf,
	writeActorOf,
} from "@/features/alerts/lib/alert-state"
import type { AdministratorAlert } from "@/features/alerts/types/alert.types"
import { staleDraftsPath } from "@/features/drafts/lib/draft-view"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { fillText, formatDateTime } from "@/lib/format"
import { liveRefreshText } from "@/lib/live-refresh"
import { APPEAR } from "@/lib/motion"
import {
	auditPagePath,
	deliveriesPagePath,
	deliveryPagePath,
	orphanedObjectsPagePath,
	userPagePath,
} from "@/lib/routes"

const texts = cs.alerts

const VIEW_FIELD_ID = "alert-view"
// DESIGN.md 9.1
const VIEW_PARAM = "view"
const SKELETON_KEYS = ["first", "second", "third"] as const

const STATE_TONE: Readonly<Record<AlertState, PillTone>> = {
	[ALERT_STATE.ACTIVE]: PILL_TONE.CRITICAL,
	[ALERT_STATE.REQUEUED]: PILL_TONE.WARN,
	[ALERT_STATE.RESOLVED]: PILL_TONE.NEUTRAL,
	[ALERT_STATE.ACKNOWLEDGED]: PILL_TONE.NEUTRAL,
}

const STATE_TEXT: Readonly<Record<AlertState, string>> = texts.state

const EMPTY_TEXT: Readonly<Record<AlertView, string>> = texts.empty

// CAP-028-R13, CAP-028-R15, CAP-021-R27
export function AlertsPage() {
	useShellTitle(texts.heading)
	const [searchParams, setSearchParams] = useSearchParams()
	const view = alertViewOf(searchParams.get(VIEW_PARAM))

	const { metrics, hasFailed } = useOperationalMetrics()

	const showView = (next: AlertView) =>
		setSearchParams(next === ALERT_VIEW.ACTIVE ? {} : { [VIEW_PARAM]: next }, { replace: true })

	return (
		<div className="flex flex-col gap-(--section-gap)">
			<SystemStatusCard metrics={metrics} hasFailed={hasFailed} />
			<AlertsCard view={view} onShowView={showView} />
			{metrics === undefined ? null : <OperationalDetailsCard metrics={metrics} />}
		</div>
	)
}

function AlertsCard({ view, onShowView }: { view: AlertView; onShowView: (view: AlertView) => void }) {
	return (
		<Card className="gap-0 py-0">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b px-(--card-p) py-3">
				<h2 className="text-sm font-semibold">{texts.listHeading}</h2>
				<div className="flex items-center gap-2">
					<Label htmlFor={VIEW_FIELD_ID} className="text-sm text-muted-foreground">
						{texts.view.label}
					</Label>
					<NativeSelect
						id={VIEW_FIELD_ID}
						value={view}
						onChange={(event) => onShowView(alertViewOf(event.target.value))}
					>
						<option value={ALERT_VIEW.ACTIVE}>{texts.view.active}</option>
						<option value={ALERT_VIEW.ALL}>{texts.view.all}</option>
					</NativeSelect>
				</div>
			</div>
			<AlertsList key={view} view={view} />
		</Card>
	)
}

function AlertsList({ view }: { view: AlertView }) {
	const { items: alerts, error, loading, hasMore, more, retry } = useAlerts(view)
	const requeue = useAlertAction(isAlreadyRequeued)
	const acknowledgement = useAlertAction(isNoLongerAcknowledgeable)

	if (alerts.length === 0) {
		if (loading) {
			return (
				<div role="status" className="flex flex-col gap-3 p-(--card-p)">
					<span className="sr-only">{cs.common.loading}</span>
					{SKELETON_KEYS.map((key) => (
						<Skeleton key={key} aria-hidden className="h-16" />
					))}
				</div>
			)
		}
		if (error !== undefined) {
			return (
				<EmptyState
					tone={EMPTY_TONE.CRITICAL}
					icon={<WarningCircleIcon weight="fill" className="size-5" />}
					title={errorMessageOf(error)}
					description={liveRefreshText()}
				/>
			)
		}
		return (
			<EmptyState
				icon={<BellIcon weight="bold" className="size-5" />}
				title={EMPTY_TEXT[view]}
				description={texts.emptyHint}
			/>
		)
	}
	return (
		<>
			<ActionFailure failure={requeue.failure} />
			<ActionFailure failure={acknowledgement.failure} />
			<ul aria-label={texts.tableLabel} className={cn("divide-y", APPEAR)}>
				{alerts.map((alert) => (
					<AlertItem key={alert.id} alert={alert} requeue={requeue} acknowledgement={acknowledgement} />
				))}
			</ul>
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
		</>
	)
}

function ActionFailure({ failure }: { failure: unknown }) {
	if (failure === undefined) {
		return null
	}
	return (
		<div className="p-(--card-p) pb-0">
			<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure)}</Notice>
		</div>
	)
}

interface AlertItemProps {
	alert: AdministratorAlert
	requeue: AlertAction
	acknowledgement: AlertAction
}

function AlertItem({ alert, requeue, acknowledgement }: AlertItemProps) {
	const state = alertStateOf(alert, {
		requeuedAlertIds: requeue.doneAlertIds,
		acknowledgedAlertIds: acknowledgement.doneAlertIds,
	})
	const acknowledged = alert.acknowledgement ?? undefined
	const deliveryId = alert.delivery_id ?? undefined
	const hasTarget = (alert.target_code ?? null) !== null
	const actorId = writeActorOf(alert)
	const rendition = renditionTextOf(alert)
	const brokenRecordId = brokenAuditRecordOf(alert)
	return (
		<li className="flex flex-col gap-3 px-(--card-p) py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span className="font-medium">{alertKindText(alert.kind)}</span>
					<StatusPill tone={STATE_TONE[state]}>{STATE_TEXT[state]}</StatusPill>
				</div>
				<p className="max-w-prose text-muted-foreground">{alert.message}</p>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					<time dateTime={alert.raised_at}>{formatDateTime(alert.raised_at)}</time>
					{rendition === undefined ? null : <span>{rendition}</span>}
					{brokenRecordId === undefined ? null : (
						<>
							<span>
								{texts.brokenRecord} <span className="identifier break-all">{brokenRecordId}</span>
							</span>
							<RowLink to={auditPagePath()}>{texts.openAudit}</RowLink>
						</>
					)}
					{actorId === undefined ? null : <RowLink to={userPagePath(actorId)}>{texts.openUser}</RowLink>}
					{isStaleDraftsAlert(alert) ? <RowLink to={staleDraftsPath()}>{texts.openDrafts}</RowLink> : null}
					{isOrphanedObjectsAlert(alert) ? (
						<RowLink to={orphanedObjectsPagePath()}>{texts.openOrphanedObjects}</RowLink>
					) : null}
					{deliveryId === undefined ? null : <RowLink to={deliveryPagePath(deliveryId)}>{texts.openDelivery}</RowLink>}
					{hasTarget ? <RowLink to={deliveriesPagePath()}>{texts.openDeliveries}</RowLink> : null}
					{acknowledged === undefined ? null : (
						<>
							<time dateTime={acknowledged.acknowledged_at}>
								{fillText(texts.acknowledgedAt, { time: formatDateTime(acknowledged.acknowledged_at) })}
							</time>
							<RowLink to={userPagePath(acknowledged.acknowledged_by_user_id)}>{texts.openUser}</RowLink>
						</>
					)}
				</div>
			</div>
			<div className="shrink-0 sm:max-w-56">
				<RequeueButton alert={alert} requeue={requeue} />
				<AcknowledgeButton alert={alert} acknowledgement={acknowledgement} />
			</div>
		</li>
	)
}

// CAP-021-R27, CAP-021-S25
function RequeueButton({ alert, requeue }: { alert: AdministratorAlert; requeue: AlertAction }) {
	const taskId = requeueTaskOf(alert)
	if (taskId === undefined) {
		return null
	}
	if (requeue.doneAlertIds.has(alert.id)) {
		return (
			<p role="status" className="text-xs text-muted-foreground">
				{texts.requeued}
			</p>
		)
	}
	return (
		<Button
			variant="outline"
			size="sm"
			disabled={requeue.pendingAlertId !== undefined}
			onClick={() => requeue.run(alert.id, () => requeueClinicalRecordWrite(taskId))}
		>
			{requeue.pendingAlertId === alert.id ? texts.requeuing : texts.requeue}
		</Button>
	)
}

// CAP-023-R12, CHG-189
function AcknowledgeButton({ alert, acknowledgement }: { alert: AdministratorAlert; acknowledgement: AlertAction }) {
	if (!isAcknowledgeable(alert) || acknowledgement.doneAlertIds.has(alert.id)) {
		return null
	}
	return (
		<Button
			variant="outline"
			size="sm"
			disabled={acknowledgement.pendingAlertId !== undefined}
			onClick={() => acknowledgement.run(alert.id, () => acknowledgeAlert(alert.id))}
		>
			{acknowledgement.pendingAlertId === alert.id ? texts.acknowledging : texts.acknowledge}
		</Button>
	)
}
