import type { ReactNode } from "react"
import { type EntryAction, EntryLayout } from "./EntryLayout"
import { Body, Title } from "./typography"

export type { EntryAction }

interface Props {
	heading: string
	body: string
	action?: EntryAction
	secondary?: EntryAction
	children?: ReactNode
}

export function EntryScreen({ heading, body, action, secondary, children }: Props) {
	return (
		<EntryLayout action={action} secondary={secondary}>
			<Title>{heading}</Title>
			<Body className="pt-3">{body}</Body>
			{children}
		</EntryLayout>
	)
}
