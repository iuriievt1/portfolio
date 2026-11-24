import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { Button } from "@/components/ui/button"

interface Props {
	errorMessage: string | undefined
	hasMore: boolean
	loading: boolean
	moreLabel: string
	loadingLabel: string
	retryLabel: string
	onMore: () => void
	onRetry: () => void
}

export function ListFooter({
	errorMessage,
	hasMore,
	loading,
	moreLabel,
	loadingLabel,
	retryLabel,
	onMore,
	onRetry,
}: Props) {
	return (
		<>
			{errorMessage === undefined ? null : (
				<div className="border-t p-(--card-p)">
					<Notice
						tone={NOTICE_TONE.CRITICAL}
						action={
							<Button variant="outline" size="sm" onClick={onRetry}>
								{retryLabel}
							</Button>
						}
					>
						{errorMessage}
					</Notice>
				</div>
			)}
			{hasMore ? (
				<div className="border-t px-(--card-p) py-3">
					<Button variant="outline" size="sm" onClick={onMore} disabled={loading}>
						{loading ? loadingLabel : moreLabel}
					</Button>
				</div>
			) : null}
		</>
	)
}
