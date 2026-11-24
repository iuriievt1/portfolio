import { CaretRightIcon, PlusIcon } from "@phosphor-icons/react"
import { useCallback, useState } from "react"
import { Link } from "react-router"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { QrCode } from "@/components/custom/QrCode"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { useIssue } from "@/features/users/hooks/use-issue"
import { issueCardBinding } from "@/features/users/hooks/use-user"
import type { Card, CardBindingCode } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { CARRIER_ISSUE_MESSAGES, errorMessageOf } from "@/lib/error-message"
import { fillText, formatCount, formatTime } from "@/lib/format"
import { userCardsPagePath } from "@/lib/routes"
import type { RequestState } from "@/lib/use-request"
import { CardsTable } from "./CardsTable"

const texts = cs.user.cards

// DESIGN.md 9.3
const DETAIL_ROWS_LIMIT = 10

interface Props {
	userId: string
	cards: RequestState<Card[]>
	canIssue: boolean
}

// DESIGN.md 9.5
export function CardsSection({ userId, cards, canIssue }: Props) {
	const binding = useIssue(useCallback(() => issueCardBinding(userId), [userId]))
	const cardCount = cards.data?.length ?? 0
	const [showing, setShowing] = useState(false)
	const issueCode = async () => setShowing((await binding.start()) !== undefined)
	const refreshAfterClose = (open: boolean) => {
		if (open) {
			return
		}
		binding.clear()
		cards.reload()
	}

	return (
		<PageSection
			title={texts.heading}
			flush
			action={
				canIssue ? (
					<Button variant="outline" size="sm" onClick={() => void issueCode()} disabled={binding.issuing}>
						<PlusIcon aria-hidden />
						{binding.issuing ? texts.issuing : texts.issue}
					</Button>
				) : undefined
			}
		>
			{binding.error === undefined ? null : (
				<div className="px-(--card-p) pb-(--card-p)">
					<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(binding.error, CARRIER_ISSUE_MESSAGES)}</Notice>
				</div>
			)}
			<CardsTable cards={cards} limit={DETAIL_ROWS_LIMIT} />
			{cardCount > DETAIL_ROWS_LIMIT ? (
				<div className="border-t px-(--card-p) py-3">
					<Link
						to={userCardsPagePath(userId)}
						className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
					>
						{fillText(texts.all, { count: formatCount(cardCount) })}
						<CaretRightIcon aria-hidden className="size-3.5" />
					</Link>
				</div>
			) : null}
			<Dialog open={showing} onOpenChange={setShowing} onOpenChangeComplete={refreshAfterClose}>
				{binding.issued === undefined ? null : <BindingCodeDialog code={binding.issued} />}
			</Dialog>
		</PageSection>
	)
}

function BindingCodeDialog({ code }: { code: CardBindingCode }) {
	return (
		<DialogContent closeLabel={cs.common.close}>
			<DialogHeader>
				<DialogTitle>{texts.codeHeading}</DialogTitle>
				<DialogDescription>{texts.codeHint}</DialogDescription>
			</DialogHeader>
			<div className="flex flex-col items-center gap-3">
				<QrCode value={code.code} label={cs.user.codeImageLabel} />
				<dl className="flex items-baseline gap-2 text-sm">
					<dt className="label-caps text-xs font-medium text-muted-foreground">{texts.codeLabel}</dt>
					<dd className="identifier font-medium">{code.code}</dd>
				</dl>
				<p className="text-sm text-muted-foreground">
					{fillText(texts.codeExpires, { time: formatTime(code.expires_at) })}
				</p>
			</div>
			<DialogFooter>
				<DialogClose render={<Button />}>{texts.done}</DialogClose>
			</DialogFooter>
		</DialogContent>
	)
}
