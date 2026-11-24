import { cn } from "cn"
import type { ReactNode } from "react"
import { APPEAR } from "@/lib/motion"

// DESIGN.md 8.6
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: DESIGN.md 8.6
		<div
			// biome-ignore lint/a11y/noNoninteractiveTabindex: DESIGN.md 8.6
			tabIndex={0}
			role="group"
			aria-label={label}
			className={cn("overflow-x-auto inset-ring-ring outline-hidden focus-visible:inset-ring-2", APPEAR)}
		>
			{children}
		</div>
	)
}
