import { DRAFT_DISCARD_REFUSAL, type DraftDiscardRefusal } from "@ansora/contracts"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import type { DraftDiscardResult } from "@/features/drafts/types/draft.types"
import cs from "@/i18n/cs.json"
import { fillText, formatCount } from "@/lib/format"

const texts = cs.drafts.result

const REFUSALS: readonly DraftDiscardRefusal[] = Object.values(DRAFT_DISCARD_REFUSAL)

// CAP-015-R20, notifikace.md U29
export function DraftResultNotice({ result }: { result: DraftDiscardResult }) {
	const lines = [
		fillText(texts.discarded, { count: formatCount(result.discarded.length) }),
		...REFUSALS.flatMap((reason) => {
			const count = result.refused.filter((refusal) => refusal.reason === reason).length
			return count === 0 ? [] : [fillText(texts[reason], { count: formatCount(count) })]
		}),
	]
	const text = lines.join(" ")
	if (result.refused.length > 0) {
		return <Notice tone={NOTICE_TONE.WARN}>{text}</Notice>
	}
	return (
		<p role="status" className="text-sm text-muted-foreground">
			{text}
		</p>
	)
}
