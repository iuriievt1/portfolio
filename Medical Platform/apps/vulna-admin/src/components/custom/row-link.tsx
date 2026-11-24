import type { ReactNode } from "react"
import { Link } from "react-router"

// DESIGN.md 9.2
export function RowLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<Link to={to} className="rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring">
			{children}
		</Link>
	)
}
