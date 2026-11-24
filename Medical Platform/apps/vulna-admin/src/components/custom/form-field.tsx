import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"

export interface FieldControl {
	id: string
	describedBy: string | undefined
	invalid: boolean
}

function hintIdOf(id: string): string {
	return `${id}-hint`
}

function errorIdOf(id: string): string {
	return `${id}-error`
}

export function describedByOf(id: string, hint: string | undefined, error: string | undefined): string | undefined {
	const ids = [hint === undefined ? undefined : hintIdOf(id), error === undefined ? undefined : errorIdOf(id)].filter(
		(part) => part !== undefined,
	)
	return ids.length === 0 ? undefined : ids.join(" ")
}

// DESIGN.md 9.4
export function FieldMessages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
	return (
		<>
			{hint === undefined ? null : (
				<p id={hintIdOf(id)} className="text-xs text-muted-foreground">
					{hint}
				</p>
			)}
			{error === undefined ? null : (
				<p id={errorIdOf(id)} className="text-xs text-destructive">
					{error}
				</p>
			)}
		</>
	)
}

interface Props {
	id: string
	label: string
	hint?: string
	error?: string
	children: (control: FieldControl) => ReactNode
}

// DESIGN.md 9.4
export function FormField({ id, label, hint, error, children }: Props) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			{children({ id, describedBy: describedByOf(id, hint, error), invalid: error !== undefined })}
			<FieldMessages id={id} hint={hint} error={error} />
		</div>
	)
}
