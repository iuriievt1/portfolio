import { DEPENDENCY_STATE, type DependencyState } from "@ansora/contracts"
import { CheckCircleIcon, CircleDashedIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { cn } from "cn"
import { Link } from "react-router"
import { EMPTY_TONE, EmptyState } from "@/components/custom/empty-state"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PILL_TONE, StatusPill } from "@/components/custom/status-pill"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
	type AttentionTile,
	attentionTilesOf,
	DEPENDENCY_STATE_TEXT,
	dependencyFieldsOf,
} from "@/features/alerts/lib/metrics-view"
import type { OperationalMetrics } from "@/features/alerts/types/alert.types"
import cs from "@/i18n/cs.json"
import { fillText, formatCount } from "@/lib/format"
import { liveRefreshText } from "@/lib/live-refresh"
import { APPEAR } from "@/lib/motion"

const texts = cs.alerts.metrics

const HINT_DELAY_MILLISECONDS = 0
const SKELETON_KEYS = ["approval", "waiting", "assembly", "failed", "review"] as const

// CAP-028-R13, CAP-028-R14, DESIGN.md 9.1
export function SystemStatusCard({
	metrics,
	hasFailed,
}: {
	metrics: OperationalMetrics | undefined
	hasFailed: boolean
}) {
	if (metrics === undefined) {
		return (
			<Card role="region" aria-label={texts.label} className="gap-0 py-0">
				<StatusPending hasFailed={hasFailed} />
			</Card>
		)
	}
	return (
		<Card role="region" aria-label={texts.label} className="gap-0 py-0">
			<AttentionTiles tiles={attentionTilesOf(metrics)} />
			<div className="flex flex-col gap-3 border-t px-(--card-p) py-3">
				{hasFailed ? <Notice tone={NOTICE_TONE.WARN}>{texts.refreshFailed}</Notice> : null}
				<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
					<DependencyList metrics={metrics} />
					<p className="text-xs text-muted-foreground">{liveRefreshText()}</p>
				</div>
			</div>
		</Card>
	)
}

// DESIGN.md 9.6
function StatusPending({ hasFailed }: { hasFailed: boolean }) {
	if (hasFailed) {
		return (
			<EmptyState
				tone={EMPTY_TONE.CRITICAL}
				icon={<WarningCircleIcon weight="fill" className="size-5" />}
				title={texts.loadFailed}
				description={liveRefreshText()}
			/>
		)
	}
	return (
		<div role="status" className="grid gap-3 p-(--card-p) lg:grid-cols-5">
			<span className="sr-only">{cs.common.loading}</span>
			{SKELETON_KEYS.map((key) => (
				<Skeleton key={key} aria-hidden className="h-14" />
			))}
		</div>
	)
}

function AttentionTiles({ tiles }: { tiles: readonly AttentionTile[] }) {
	return (
		<ul
			aria-label={texts.attention.label}
			className={cn("grid divide-y lg:grid-cols-5 lg:divide-x lg:divide-y-0", APPEAR)}
		>
			{tiles.map((tile) => (
				<li key={tile.label}>
					<Link
						to={tile.to}
						className="flex h-full items-center justify-between gap-3 px-(--card-p) py-3 transition-colors outline-hidden hover:bg-accent focus-visible:inset-ring-2 focus-visible:inset-ring-ring lg:flex-col lg:items-start lg:justify-start lg:py-4"
					>
						<span className="text-sm text-muted-foreground">{tile.label}</span>
						<span
							className={cn(
								"num text-2xl leading-none font-semibold lg:text-left",
								tile.count === 0 && "text-muted-foreground",
							)}
						>
							{tile.count === undefined ? texts.notReported : formatCount(tile.count)}
						</span>
					</Link>
				</li>
			))}
		</ul>
	)
}

// CAP-028-R05, CAP-028-R20
function DependencyList({ metrics }: { metrics: OperationalMetrics }) {
	return (
		<ul aria-label={texts.dependencies.heading} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
			{dependencyFieldsOf(metrics).map((field) => (
				<li key={field.term} className="flex items-center gap-1.5">
					<DependencyIcon state={field.state} />
					<span className="text-muted-foreground">{fillText(texts.dependencies.item, { name: field.term })}</span>
					<DependencyStateText state={field.state} />
				</li>
			))}
		</ul>
	)
}

// DESIGN.md 3.8, 10.2
function DependencyIcon({ state }: { state: DependencyState }) {
	if (state === DEPENDENCY_STATE.AVAILABLE) {
		return <CheckCircleIcon aria-hidden className="size-4 text-muted-foreground" />
	}
	if (state === DEPENDENCY_STATE.UNAVAILABLE) {
		return <WarningCircleIcon aria-hidden weight="fill" className="size-4 text-status-crit-fg" />
	}
	return <CircleDashedIcon aria-hidden className="size-4 text-muted-foreground" />
}

// DESIGN.md 3.8
function DependencyStateText({ state }: { state: DependencyState }) {
	if (state === DEPENDENCY_STATE.UNAVAILABLE) {
		return <StatusPill tone={PILL_TONE.CRITICAL}>{DEPENDENCY_STATE_TEXT[state]}</StatusPill>
	}
	if (state === DEPENDENCY_STATE.UNKNOWN) {
		return (
			<Tooltip>
				<TooltipTrigger
					delay={HINT_DELAY_MILLISECONDS}
					render={
						<button
							type="button"
							className="cursor-help rounded-sm text-muted-foreground underline decoration-dotted underline-offset-4 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
						/>
					}
				>
					{DEPENDENCY_STATE_TEXT[state]}
				</TooltipTrigger>
				<TooltipContent>{texts.dependencies.unknownHint}</TooltipContent>
			</Tooltip>
		)
	}
	return <span className="font-medium">{DEPENDENCY_STATE_TEXT[state]}</span>
}
