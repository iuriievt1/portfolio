import { cn } from "cn"
import { type ReactNode, useId } from "react"
import { Card } from "@/components/ui/card"
import { APPEAR } from "@/lib/motion"

interface SectionProps {
	id?: string
	title: string
	description?: string
	action?: ReactNode
	flush?: boolean
	children: ReactNode
}

// DESIGN.md 8.6
export function PageSection({ id, title, description, action, flush = false, children }: SectionProps) {
	const headingId = useId()
	return (
		<section id={id} aria-labelledby={headingId} className="flex scroll-mt-4 flex-col">
			<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-(--card-p) pt-(--card-p)">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 id={headingId} className="text-sm font-semibold">
						{title}
					</h2>
					{description === undefined ? null : <p className="text-sm text-muted-foreground">{description}</p>}
				</div>
				{action}
			</div>
			<div className={cn("pt-4", flush ? undefined : "px-(--card-p) pb-(--card-p)")}>{children}</div>
		</section>
	)
}

// DESIGN.md 5.2, 8.6
export function PageSections({ narrow = false, children }: { narrow?: boolean; children: ReactNode }) {
	return <Card className={cn("gap-0 divide-y py-0", narrow && "max-w-4xl", APPEAR)}>{children}</Card>
}
