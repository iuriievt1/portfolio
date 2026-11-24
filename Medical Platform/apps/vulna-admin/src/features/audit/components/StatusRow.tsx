import type { ReactNode } from "react"

interface Props {
	icon: ReactNode
	title: string
	action?: ReactNode
	notices?: ReactNode
	children: ReactNode
}

// DESIGN.md 9.1
export function StatusRow({ icon, title, action, notices, children }: Props) {
	return (
		<section aria-label={title} className="flex flex-col gap-3 px-(--card-p) py-3">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<span className="flex items-center gap-2 text-sm font-semibold">
					<span className="text-muted-foreground">{icon}</span>
					{title}
				</span>
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">{children}</div>
				{action}
			</div>
			{notices}
		</section>
	)
}
