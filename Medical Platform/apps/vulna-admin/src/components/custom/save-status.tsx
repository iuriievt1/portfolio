// DESIGN.md 8.7
export function SaveStatus({ message }: { message: string | undefined }) {
	return (
		<p role="status" className="text-xs text-muted-foreground">
			{message}
		</p>
	)
}
