import { LoadFailure } from "@/components/custom/load-failure"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import cs from "@/i18n/cs.json"

interface Props {
	failed: boolean
	onRetry: () => void
}

export function StartupScreen({ failed, onRetry }: Props) {
	return (
		<div className="flex min-h-svh bg-background">
			<div
				aria-hidden
				className="hidden w-(--sidebar-width) shrink-0 border-r border-sidebar-border bg-sidebar md:block"
			/>
			<div className="flex min-w-0 flex-1 flex-col">
				<div aria-hidden className="h-(--topbar-height) shrink-0 border-b" />
				<main className="flex flex-1 flex-col gap-(--section-gap) p-(--section-gap)">
					{failed ? (
						<Card className="py-0">
							<LoadFailure
								title={cs.session.loadFailed}
								description={cs.errors.generic}
								retryLabel={cs.errors.retry}
								onRetry={onRetry}
							/>
						</Card>
					) : (
						<div role="status">
							<span className="sr-only">{cs.session.loading}</span>
							<Skeleton aria-hidden className="h-48 rounded-xl" />
						</div>
					)}
				</main>
			</div>
		</div>
	)
}
