import type { ReactNode } from "react"
import { ENTRY_OFFSET, type EntryAction, EntryLayout, type EntryOffset } from "./EntryLayout"
import { Body, Detail, Heading } from "./typography"

const HEADING_GAP: Record<EntryOffset, string> = {
	[ENTRY_OFFSET.ENTRY]: "pt-4",
	[ENTRY_OFFSET.FEEDBACK]: "pt-6",
}

interface Props {
	icon: ReactNode
	heading: string
	body: string
	note?: string
	action?: EntryAction
	secondary?: EntryAction
	offset?: EntryOffset
	children?: ReactNode
}

/** A state the user has run into: an icon, what happened and what to do about it. */
export function FeedbackScreen({
	icon,
	heading,
	body,
	note,
	action,
	secondary,
	offset = ENTRY_OFFSET.ENTRY,
	children,
}: Props) {
	return (
		<EntryLayout action={action} secondary={secondary} offset={offset}>
			{icon}
			<Heading className={HEADING_GAP[offset]}>{heading}</Heading>
			<Body className="pt-4">{body}</Body>
			{note === undefined ? null : <Detail className="pt-6">{note}</Detail>}
			{children}
		</EntryLayout>
	)
}
