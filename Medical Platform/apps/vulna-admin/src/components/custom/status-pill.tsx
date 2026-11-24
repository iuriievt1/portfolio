import { cn } from "cn"
import type { ReactNode } from "react"

export const PILL_TONE = {
	NEUTRAL: "neutral",
	WARN: "warn",
	CRITICAL: "critical",
} as const

export type PillTone = (typeof PILL_TONE)[keyof typeof PILL_TONE]

const TONE_CLASS: Readonly<Record<PillTone, string>> = {
	[PILL_TONE.NEUTRAL]: "bg-status-ok text-status-ok-fg",
	[PILL_TONE.WARN]: "bg-status-warn text-status-warn-fg",
	[PILL_TONE.CRITICAL]: "bg-status-crit text-status-crit-fg",
}

interface Props {
	tone?: PillTone
	children: NonNullable<ReactNode>
}

// DESIGN.md 8.5
export function StatusPill({ tone = PILL_TONE.NEUTRAL, children }: Props) {
	return (
		<span
			className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone])}
		>
			{children}
		</span>
	)
}
