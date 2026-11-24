import type { ReactNode } from "react"

// DESIGN.md 9.2
export function RowButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-sm text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
		>
			{children}
		</button>
	)
}
