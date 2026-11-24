import { LoadFailure } from "@/components/custom/load-failure"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
	failure: string | undefined
	loadingLabel: string
	retryLabel: string
	onRetry: () => void
}

// DESIGN.md 9.6
export function PagePending({ failure, loadingLabel, retryLabel, onRetry }: Props) {
	if (failure === undefined) {
		return (
			<div role="status">
				<span className="sr-only">{loadingLabel}</span>
				<Skeleton aria-hidden className="h-40 rounded-xl" />
			</div>
		)
	}
	return (
		<Card className="py-0">
			<LoadFailure title={failure} retryLabel={retryLabel} onRetry={onRetry} />
		</Card>
	)
}
