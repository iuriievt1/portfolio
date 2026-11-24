import { WarningCircleIcon } from "@phosphor-icons/react"
import { EMPTY_TONE, EmptyState } from "@/components/custom/empty-state"
import { Button } from "@/components/ui/button"

interface Props {
	title: string
	description?: string
	retryLabel: string
	onRetry: () => void
}

// DESIGN.md 9.6
export function LoadFailure({ title, description, retryLabel, onRetry }: Props) {
	return (
		<EmptyState
			tone={EMPTY_TONE.CRITICAL}
			icon={<WarningCircleIcon weight="fill" className="size-5" />}
			title={title}
			description={description}
			action={
				<Button variant="outline" size="sm" onClick={onRetry}>
					{retryLabel}
				</Button>
			}
		/>
	)
}
