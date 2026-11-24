import { cn } from "cn"
import type { ReactNode } from "react"

export const EMPTY_TONE = {
	NEUTRAL: "neutral",
	CRITICAL: "critical",
} as const

type EmptyTone = (typeof EMPTY_TONE)[keyof typeof EMPTY_TONE]

const CHIP_CLASS: Readonly<Record<EmptyTone, string>> = {
	[EMPTY_TONE.NEUTRAL]: "bg-muted text-muted-foreground",
	[EMPTY_TONE.CRITICAL]: "bg-status-crit text-status-crit-fg",
}

interface Props {
	icon: ReactNode
	title: string
	description?: string
	tone?: EmptyTone
	action?: ReactNode
}

// DESIGN.md 8.7, 9.6
export function EmptyState({ icon, title, description, tone = EMPTY_TONE.NEUTRAL, action }: Props) {
	return (
		<div role="status" className="flex flex-col items-center gap-3 px-(--card-p) py-10 text-center">
			<span aria-hidden className={cn("flex size-10 items-center justify-center rounded-full", CHIP_CLASS[tone])}>
				{icon}
			</span>
			<div className="flex max-w-sm flex-col gap-1 text-sm text-muted-foreground">
				<p className="font-medium text-foreground">{title}</p>
				{description === undefined ? null : <p>{description}</p>}
			</div>
			{action}
		</div>
	)
}
