import { NOTICE_TONE, Notice } from "@/components/custom/notice"

// CAP-012-R26, CAP-012-R27
export function SaveWarnings({ messages }: { messages: readonly string[] }) {
	if (messages.length === 0) {
		return null
	}
	return (
		<div className="flex flex-col gap-2">
			{messages.map((message) => (
				<Notice key={message} tone={NOTICE_TONE.WARN}>
					{message}
				</Notice>
			))}
		</div>
	)
}
