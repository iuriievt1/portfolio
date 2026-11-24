import { useState } from "react"
import { errorCodeOf } from "@/api/client"
import { NOTICE_TONE, Notice, type NoticeTone } from "@/components/custom/notice"
import { Button } from "@/components/ui/button"
import { errorMessageOf, type MessageByCode } from "@/lib/error-message"

interface Props {
	tone: NoticeTone
	title: string
	body: string
	actionLabel: string
	actingLabel: string
	messages: MessageByCode
	act: () => Promise<void>
	onDone: () => void
}

// CAP-023-R23, CAP-023-R26
function hasStateChanged(error: unknown, messages: MessageByCode): boolean {
	const code = errorCodeOf(error)
	return code !== undefined && Object.hasOwn(messages, code)
}

// CAP-023-R23, CAP-023-R26, DESIGN.md 3.8
export function ActionNotice({ tone, title, body, actionLabel, actingLabel, messages, act, onDone }: Props) {
	const [isActing, setIsActing] = useState(false)
	const [failure, setFailure] = useState<unknown>(undefined)

	const perform = () => {
		setIsActing(true)
		setFailure(undefined)
		act()
			.then(onDone)
			.catch((error: unknown) => {
				setFailure(error)
				if (hasStateChanged(error, messages)) {
					onDone()
				}
			})
			.finally(() => setIsActing(false))
	}

	return (
		<div className="flex flex-col gap-2">
			<Notice
				tone={tone}
				action={
					<Button size="sm" variant="outline" disabled={isActing} onClick={perform}>
						{isActing ? actingLabel : actionLabel}
					</Button>
				}
			>
				<span className="block font-medium">{title}</span>
				<span className="block">{body}</span>
			</Notice>
			{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, messages)}</Notice>}
		</div>
	)
}
