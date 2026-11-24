import type { ReactNode } from "react"

interface DetailField {
	term: string
	value: ReactNode
}

// DESIGN.md 8.8
export function DetailFields({ fields }: { fields: readonly DetailField[] }) {
	return (
		<div className="@container">
			<dl className="grid gap-x-(--card-p) gap-y-3 text-sm @md:grid-cols-2">
				{fields.map((field) => (
					<div key={field.term}>
						<dt className="label-caps text-xs font-medium text-muted-foreground">{field.term}</dt>
						<dd className="mt-0.5 text-foreground">{field.value}</dd>
					</div>
				))}
			</dl>
		</div>
	)
}
