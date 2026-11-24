import { WarningCircleIcon, WarningIcon } from "@phosphor-icons/react"
import { cn } from "cn"
import type { ReactNode } from "react"

export const NOTICE_TONE = {
	WARN: "warn",
	CRITICAL: "critical",
} as const

export type NoticeTone = (typeof NOTICE_TONE)[keyof typeof NOTICE_TONE]

const TONE_CLASS: Readonly<Record<NoticeTone, string>> = {
	[NOTICE_TONE.WARN]: "bg-status-warn text-status-warn-fg",
	[NOTICE_TONE.CRITICAL]: "bg-status-crit text-status-crit-fg",
}

const TONE_ICON: Readonly<Record<NoticeTone, ReactNode>> = {
	[NOTICE_TONE.WARN]: <WarningIcon weight="fill" className="size-4" />,
	[NOTICE_TONE.CRITICAL]: <WarningCircleIcon weight="fill" className="size-4" />,
}

interface Props {
	tone: NoticeTone
	icon?: ReactNode
	action?: ReactNode
	children: NonNullable<ReactNode>
}

// DESIGN.md 3.8, 10.3
export function Notice({ tone, icon = TONE_ICON[tone], action, children }: Props) {
	return (
		<div role="status" className={cn("flex items-start gap-2 rounded-lg px-(--card-p) py-3 text-sm", TONE_CLASS[tone])}>
			<span aria-hidden className="flex h-lh shrink-0 items-center">
				{icon}
			</span>
			<p className="flex-1">{children}</p>
			{action}
		</div>
	)
}
